import yfinance as yf
import pandas as pd
from pypfopt.efficient_frontier import EfficientFrontier
from pypfopt import risk_models, expected_returns
from core.cache import get_cache, set_cache

# ── Company name map for sentiment lookup ─────────────────────────────────────
COMPANY_MAP = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "Tata Consultancy Services",
    "INFY.NS": "Infosys",
    "HDFCBANK.NS": "HDFC Bank",
    "BAJFINANCE.NS": "Bajaj Finance",
    "TITAN.NS": "Titan Company",
    "ADANIENT.NS": "Adani Enterprises",
    "WIPRO.NS": "Wipro",
    "ICICIBANK.NS": "ICICI Bank",
    "KOTAKBANK.NS": "Kotak Mahindra Bank",
    "HINDUNILVR.NS": "Hindustan Unilever",
    "ASIANPAINT.NS": "Asian Paints",
    "MARUTI.NS": "Maruti Suzuki",
    "SUNPHARMA.NS": "Sun Pharmaceutical",
    "LTIM.NS": "LTIMindtree",
    "AXISBANK.NS": "Axis Bank",
    "NESTLEIND.NS": "Nestle India",
    "TATAMOTORS.NS": "Tata Motors",
    "ONGC.NS": "ONGC",
    "POWERGRID.NS": "Power Grid Corporation",
}

# ── Tilt constants ────────────────────────────────────────────────────────────
# How much each signal nudges the expected return before optimization.
# Kept small so signals adjust but don't override quantitative estimates.
ML_TILT_UP        =  0.020   # +2%  if model says UP
ML_TILT_DOWN      = -0.020   # -2%  if model says DOWN
SENTIMENT_MAX     =  0.015   # ±1.5% scaled by aggregate_score (-1 to +1)
TECHNICAL_PER_PT  =  0.004   # ±0.4% per point of technical score (capped ±5 pts)


# ── helpers ───────────────────────────────────────────────────────────────────

def fetch_closing_prices(tickers: list, period: str = "2y") -> pd.DataFrame:
    data = {}
    for ticker in tickers:
        t = yf.Ticker(ticker)
        df = t.history(period=period)
        if not df.empty:
            data[ticker] = df["Close"]
    if not data:
        raise ValueError("No price data found for any ticker")
    return pd.DataFrame(data).dropna()


def _build_ef(mu, S, n: int) -> EfficientFrontier:
    """Weight bounds: min 5%, max min(60%, 2/n) so no single stock dominates."""
    max_w = min(0.60, round(2 / n, 2))
    return EfficientFrontier(mu, S, weight_bounds=(0.05, max_w))


def _optimize(mu, S, n: int):
    """Try max_sharpe(rf=0) first, fall back to min_volatility."""
    try:
        ef = _build_ef(mu, S, n)
        ef.max_sharpe(risk_free_rate=0)
        return ef.clean_weights(), ef.portfolio_performance(risk_free_rate=0)
    except Exception:
        ef = _build_ef(mu, S, n)
        ef.min_volatility()
        return ef.clean_weights(), ef.portfolio_performance(risk_free_rate=0)


def _collect_tilts(tickers: list) -> tuple[dict, dict]:
    from services.ml_service import get_signal
    from services.sentiment_service import get_sentiment
    from services.technical_signal_service import get_technical_signal
    from concurrent.futures import ThreadPoolExecutor, as_completed

    tilts = {}
    reasons = {}

    def process_ticker(ticker):
        tilt = 0.0
        ticker_reasons = []

        # ML signal
        try:
            ml = get_signal(ticker)
            signal = ml.get("signal", "NEUTRAL")
            confidence = ml.get("confidence", 0.5)
            if signal == "UP":
                t = ML_TILT_UP * confidence
                tilt += t
                ticker_reasons.append(f"ML model predicts UP (confidence {confidence:.0%}) → return tilted +{t*100:.2f}%")
            elif signal == "DOWN":
                t = ML_TILT_DOWN * confidence
                tilt += t
                ticker_reasons.append(f"ML model predicts DOWN (confidence {confidence:.0%}) → return tilted {t*100:.2f}%")
            else:
                ticker_reasons.append("ML signal: NEUTRAL — no tilt applied")
        except Exception as e:
            ticker_reasons.append(f"ML signal unavailable ({e})")

        # Sentiment
        try:
            company = COMPANY_MAP.get(ticker, ticker.replace(".NS", "").replace(".BO", ""))
            sent = get_sentiment(company)
            agg = sent.get("aggregate_score", 0)
            overall = sent.get("overall_sentiment", "NEUTRAL")
            t = round(agg * SENTIMENT_MAX, 4)
            tilt += t
            if abs(agg) > 0.1:
                direction = "+" if t >= 0 else ""
                ticker_reasons.append(f"News sentiment {overall} (score {agg:+.2f}) → return tilted {direction}{t*100:.2f}%")
            else:
                ticker_reasons.append(f"News sentiment NEUTRAL (score {agg:+.2f}) — minimal tilt")
        except Exception as e:
            ticker_reasons.append(f"Sentiment unavailable ({e})")

        # Technical signal
        try:
            tech = get_technical_signal(ticker)
            score = tech.get("score", 0)
            decision = tech.get("decision", "HOLD")
            capped_score = max(-5, min(5, score))
            t = round(capped_score * TECHNICAL_PER_PT, 4)
            tilt += t
            tech_reasons = tech.get("reasons", [])
            summary = "; ".join(tech_reasons[:2]) if tech_reasons else "no detail"
            direction = "+" if t >= 0 else ""
            ticker_reasons.append(f"Technical signal {decision} (score {score:+d}: {summary}) → return tilted {direction}{t*100:.2f}%")
        except Exception as e:
            ticker_reasons.append(f"Technical signal unavailable ({e})")

        return ticker, round(tilt, 4), ticker_reasons

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_ticker, ticker): ticker for ticker in tickers}
        for future in as_completed(futures):
            ticker, tilt, ticker_reasons = future.result()
            tilts[ticker] = tilt
            reasons[ticker] = ticker_reasons

    return tilts, reasons


# ── public API ────────────────────────────────────────────────────────────────

def optimize_portfolio(tickers: list) -> dict:
    """Simple optimization without holdings context (used by /portfolio/optimize)."""
    if len(tickers) < 2:
        raise ValueError("Need at least 2 tickers to optimize")

    df = fetch_closing_prices(tickers)
    if df.shape[0] < 30:
        raise ValueError("Not enough historical data to optimize")

    mu = expected_returns.capm_return(df)
    S  = risk_models.CovarianceShrinkage(df).ledoit_wolf()

    cleaned_weights, performance = _optimize(mu, S, len(tickers))

    return {
        "weights": {k: round(v, 4) for k, v in cleaned_weights.items()},
        "expected_annual_return": round(performance[0], 4),
        "annual_volatility":      round(performance[1], 4),
        "sharpe_ratio":           round(performance[2], 4),
    }


def analyze_and_optimize(holdings: list) -> dict:
    """
    Full portfolio analysis + signal-tilted optimization.
    holdings = [{"ticker": "RELIANCE.NS", "quantity": 50, "avg_buy_price": 1300}, ...]
    """
    tickers = [h["ticker"] for h in holdings]

    if len(tickers) < 2:
        raise ValueError("Need at least 2 holdings to optimize")

    # ── Live prices ───────────────────────────────────────────────
    live_prices = {}
    for ticker in tickers:
        cache_key = f"live_price:{ticker}"
        cached = get_cache(cache_key)
        if cached:
            live_prices[ticker] = cached
            continue
        try:
            info = yf.Ticker(ticker).fast_info
            price = info.last_price
            price_val = round(float(price), 2) if price else None
            live_prices[ticker] = price_val
            if price_val:
                set_cache(cache_key, price_val, ttl=300)  # 5 min cache
        except Exception:
            live_prices[ticker] = None
    # ── Current portfolio value + PnL ─────────────────────────────
    current_values = {}
    pnl_per_stock  = {}
    for h in holdings:
        ticker = h["ticker"]
        price  = live_prices.get(ticker)
        if price:
            market_value = price * h["quantity"]
            cost_basis   = h["avg_buy_price"] * h["quantity"]
            current_values[ticker] = market_value
            pnl_per_stock[ticker]  = round(market_value - cost_basis, 2)

    total_value = sum(current_values.values())

    current_weights = {
        ticker: round(val / total_value, 4)
        for ticker, val in current_values.items()
    }

    # ── Historical data + base estimates ──────────────────────────
    df = fetch_closing_prices(tickers)
    mu = expected_returns.capm_return(df)
    S  = risk_models.CovarianceShrinkage(df).ledoit_wolf()

    # ── Current portfolio performance ─────────────────────────────
    w           = pd.Series([current_weights.get(t, 0) for t in df.columns], index=df.columns)
    current_ret = float(mu @ w)
    current_vol = float((w @ S @ w) ** 0.5)
    current_sharpe = round(current_ret / current_vol, 4) if current_vol > 0 else 0.0

    # ── Collect signal tilts ──────────────────────────────────────
    tilts, reasons = _collect_tilts(tickers)

    # Apply tilts to mu
    mu_tilted = mu.copy()
    for ticker, tilt in tilts.items():
        if ticker in mu_tilted.index:
            mu_tilted[ticker] = mu_tilted[ticker] + tilt

    # ── Optimized portfolio (signal-tilted) ───────────────────────
    optimized_weights, performance = _optimize(mu_tilted, S, len(tickers))

    # ── Build signal summary per ticker ───────────────────────────
    signal_reasons = {
        ticker: {
            "tilt":    tilts.get(ticker, 0),
            "reasons": reasons.get(ticker, []),
        }
        for ticker in tickers
    }

    return {
        "total_portfolio_value": round(total_value, 2),
        "total_cost_basis":      round(sum(h["avg_buy_price"] * h["quantity"] for h in holdings), 2),
        "current_prices":        {k: v for k, v in live_prices.items() if v is not None},
        "pnl_per_stock":         pnl_per_stock,
        "total_pnl":             round(sum(pnl_per_stock.values()), 2),
        "current_allocation":    current_weights,
        "current_performance": {
            "expected_annual_return": round(current_ret, 4),
            "annual_volatility":      round(current_vol, 4),
            "sharpe_ratio":           current_sharpe,
        },
        "optimized_allocation": {k: round(v, 4) for k, v in optimized_weights.items()},
        "optimized_performance": {
            "expected_annual_return": round(performance[0], 4),
            "annual_volatility":      round(performance[1], 4),
            "sharpe_ratio":           round(performance[2], 4),
        },
        "signal_reasons":   signal_reasons,
        "recommendation":   "Rebalance to the optimized allocation to improve risk-adjusted returns.",
    }