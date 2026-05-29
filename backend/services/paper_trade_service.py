import yfinance as yf
from routers.stock import resolve_ticker

SLIPPAGE_RATE = 0.001   # 0.1% slippage
FEE_RATE = 0.001        # 0.1% broker fee
STARTING_BALANCE = 100000.0  # ₹1,00,000

def get_live_price(ticker: str) -> float:
    resolved = resolve_ticker(ticker)
    info = yf.Ticker(resolved).fast_info
    price = info.last_price
    if not price:
        raise ValueError(f"Could not fetch live price for {ticker}")
    return round(float(price), 2)

def calculate_trade(action: str, price: float, quantity: int) -> dict:
    slippage = round(price * SLIPPAGE_RATE, 4)
    executed_price = price + slippage if action == "BUY" else price - slippage
    fees = round(executed_price * quantity * FEE_RATE, 4)
    total_cost = round(executed_price * quantity + fees, 2)
    return {
        "executed_price": round(executed_price, 2),
        "slippage": slippage,
        "fees": fees,
        "total_cost": total_cost
    }

def execute_trade(user_id: int, ticker: str, action: str, quantity: int, db) -> dict:
    from models.user import SimulatedTrade, VirtualPortfolio

    # get or create portfolio
    portfolio = db.query(VirtualPortfolio).filter(VirtualPortfolio.user_id == user_id).first()
    if not portfolio:
        portfolio = VirtualPortfolio(user_id=user_id, balance=STARTING_BALANCE)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    price = get_live_price(ticker)
    trade = calculate_trade(action, price, quantity)

    if action == "BUY" and portfolio.balance < trade["total_cost"]:
        raise ValueError(f"Insufficient balance. Need ₹{trade['total_cost']}, have ₹{portfolio.balance}")

    # update balance
    if action == "BUY":
        portfolio.balance = round(portfolio.balance - trade["total_cost"], 2)
    else:
        portfolio.balance = round(portfolio.balance + trade["total_cost"], 2)

    # record trade
    new_trade = SimulatedTrade(
        user_id=user_id,
        ticker=resolve_ticker(ticker),
        action=action,
        quantity=quantity,
        price=price,
        slippage=trade["slippage"],
        fees=trade["fees"],
        total_cost=trade["total_cost"]
    )
    db.add(new_trade)
    db.commit()

    return {
        "action": action,
        "ticker": resolve_ticker(ticker),
        "quantity": quantity,
        "market_price": price,
        "executed_price": trade["executed_price"],
        "slippage": trade["slippage"],
        "fees": trade["fees"],
        "total_cost": trade["total_cost"],
        "remaining_balance": portfolio.balance
    }

def get_portfolio(user_id: int, db) -> dict:
    from models.user import SimulatedTrade, VirtualPortfolio

    portfolio = db.query(VirtualPortfolio).filter(VirtualPortfolio.user_id == user_id).first()
    if not portfolio:
        return {"balance": STARTING_BALANCE, "trades": []}

    trades = db.query(SimulatedTrade).filter(SimulatedTrade.user_id == user_id).order_by(SimulatedTrade.created_at.desc()).all()

    return {
        "balance": portfolio.balance,
        "trades_count": len(trades),
        "trades": [
            {
                "ticker": t.ticker,
                "action": t.action,
                "quantity": t.quantity,
                "price": t.price,
                "fees": t.fees,
                "total_cost": t.total_cost,
                "timestamp": str(t.created_at)
            } for t in trades
        ]
    }