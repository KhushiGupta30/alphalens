import yfinance as yf
from routers.stock import resolve_ticker
from collections import defaultdict
from datetime import timezone, timedelta

SLIPPAGE_RATE  = 0.001    # 0.1%
FEE_RATE       = 0.001    # 0.1%
STARTING_BALANCE = 100000.0

IST = timezone(timedelta(hours=5, minutes=30))

def to_ist(dt):
    if dt is None: return "—"
    dt_utc = dt.replace(tzinfo=timezone.utc)  # treat stored value as UTC
    dt_ist = dt_utc.astimezone(IST)
    return dt_ist.strftime("%d %b %Y, %I:%M %p")


def get_live_price(ticker: str) -> float:
    resolved = resolve_ticker(ticker)
    info = yf.Ticker(resolved).fast_info
    price = info.last_price
    if not price:
        raise ValueError(f"Could not fetch live price for {ticker}")
    return round(float(price), 2)


def calculate_trade(action: str, price: float, quantity: int) -> dict:
    slippage      = round(price * SLIPPAGE_RATE, 4)
    executed_price = price + slippage if action == "BUY" else price - slippage
    fees          = round(executed_price * quantity * FEE_RATE, 4)
    total_cost    = round(executed_price * quantity + fees, 2)
    return {
        "executed_price": round(executed_price, 2),
        "slippage":       slippage,
        "fees":           fees,
        "total_cost":     total_cost,
    }


def execute_trade(user_id: int, ticker: str, action: str, quantity: int, db) -> dict:
    from models.user import SimulatedTrade, VirtualPortfolio

    portfolio = db.query(VirtualPortfolio).filter(
        VirtualPortfolio.user_id == user_id
    ).first()
    if not portfolio:
        portfolio = VirtualPortfolio(user_id=user_id, balance=STARTING_BALANCE)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    resolved = resolve_ticker(ticker)
    price    = get_live_price(ticker)
    trade    = calculate_trade(action, price, quantity)

    if action == "BUY" and portfolio.balance < trade["total_cost"]:
        raise ValueError(
            f"Insufficient balance. Need ₹{trade['total_cost']}, have ₹{portfolio.balance}"
        )

    portfolio.balance = round(
        portfolio.balance - trade["total_cost"] if action == "BUY"
        else portfolio.balance + trade["total_cost"],
        2
    )

    db.add(SimulatedTrade(
        user_id=user_id,
        ticker=resolved,
        action=action,
        quantity=quantity,
        price=price,
        slippage=trade["slippage"],
        fees=trade["fees"],
        total_cost=trade["total_cost"],
    ))
    db.commit()

    return {
        "action":            action,
        "ticker":            resolved,
        "quantity":          quantity,
        "market_price":      price,
        "executed_price":    trade["executed_price"],
        "slippage":          trade["slippage"],
        "fees":              trade["fees"],
        "total_cost":        trade["total_cost"],
        "remaining_balance": portfolio.balance,
    }


def _compute_holdings(trades: list) -> dict:
    """
    Replay trade history to compute open positions with avg cost basis.
    Returns {ticker: {quantity, avg_price, cost_basis}}
    """
    positions = defaultdict(lambda: {"quantity": 0, "cost_basis": 0.0})

    for t in sorted(trades, key=lambda x: x.created_at):
        pos = positions[t.ticker]
        if t.action == "BUY":
            total_qty  = pos["quantity"] + t.quantity
            total_cost = pos["cost_basis"] + t.total_cost
            pos["quantity"]   = total_qty
            pos["cost_basis"] = round(total_cost, 2)
        else:  # SELL
            if pos["quantity"] >= t.quantity:
                ratio             = t.quantity / pos["quantity"] if pos["quantity"] else 0
                pos["cost_basis"] = round(pos["cost_basis"] * (1 - ratio), 2)
                pos["quantity"]  -= t.quantity

    # Drop closed positions
    return {
        ticker: {
            "quantity":   pos["quantity"],
            "avg_price":  round(pos["cost_basis"] / pos["quantity"], 2) if pos["quantity"] else 0,
            "cost_basis": pos["cost_basis"],
        }
        for ticker, pos in positions.items()
        if pos["quantity"] > 0
    }


def get_portfolio(user_id: int, db) -> dict:
    from models.user import SimulatedTrade, VirtualPortfolio

    portfolio = db.query(VirtualPortfolio).filter(
        VirtualPortfolio.user_id == user_id
    ).first()
    if not portfolio:
        return {
            "balance":               STARTING_BALANCE,
            "trades_count":          0,
            "trades":                [],
            "holdings":              {},
            "total_portfolio_value": STARTING_BALANCE,
            "total_unrealized_pnl":  0.0,
        }

    trades = db.query(SimulatedTrade).filter(
        SimulatedTrade.user_id == user_id
    ).order_by(SimulatedTrade.created_at.asc()).all()

    # ── Compute open positions ────────────────────────────────
    raw_holdings = _compute_holdings(trades)

    # ── Fetch live prices + compute PnL ──────────────────────
    holdings_with_pnl = {}
    total_market_value = 0.0

    for ticker, pos in raw_holdings.items():
        try:
            live_price    = get_live_price(ticker)
            market_value  = round(live_price * pos["quantity"], 2)
            unrealized    = round(market_value - pos["cost_basis"], 2)
        except Exception:
            live_price    = None
            market_value  = pos["cost_basis"]   # fallback to cost
            unrealized    = None

        total_market_value += market_value
        holdings_with_pnl[ticker] = {
            "quantity":        pos["quantity"],
            "avg_price":       pos["avg_price"],
            "cost_basis":      pos["cost_basis"],
            "current_price":   live_price,
            "current_value":   round(market_value, 2),
            "unrealized_pnl":  unrealized,
        }

    total_portfolio_value  = round(portfolio.balance + total_market_value, 2)
    total_unrealized_pnl   = round(
        sum(h["unrealized_pnl"] for h in holdings_with_pnl.values() if h["unrealized_pnl"] is not None),
        2
    )

    return {
        "balance":               portfolio.balance,
        "trades_count":          len(trades),
        "holdings":              holdings_with_pnl,
        "total_portfolio_value": total_portfolio_value,
        "total_unrealized_pnl":  total_unrealized_pnl,
        "trades": [
            {
                "ticker":     t.ticker,
                "action":     t.action,
                "quantity":   t.quantity,
                "price":      t.price,
                "fees":       t.fees,
                "total_cost": t.total_cost,
                "timestamp": to_ist(t.created_at),
            }
            for t in reversed(trades)   # newest first
        ],
    }