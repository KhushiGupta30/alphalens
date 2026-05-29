import yfinance as yf
import pandas as pd
from pypfopt.efficient_frontier import EfficientFrontier
from pypfopt import risk_models, expected_returns


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


def optimize_portfolio(tickers: list) -> dict:
    if len(tickers) < 2:
        raise ValueError("Need at least 2 tickers to optimize")

    df = fetch_closing_prices(tickers)

    if df.shape[0] < 30:
        raise ValueError("Not enough historical data to optimize")

    mu = expected_returns.mean_historical_return(df)
    S = risk_models.sample_cov(df)

    ef = EfficientFrontier(mu, S)
    ef.max_sharpe()
    cleaned_weights = ef.clean_weights()
    performance = ef.portfolio_performance()

    return {
        "weights": {k: round(v, 4) for k, v in cleaned_weights.items()},
        "expected_annual_return": round(performance[0], 4),
        "annual_volatility": round(performance[1], 4),
        "sharpe_ratio": round(performance[2], 4),
    }


def analyze_and_optimize(holdings: list) -> dict:
    # holdings = [{"ticker": "RELIANCE.NS", "quantity": 50, "avg_buy_price": 1300}, ...]
    tickers = [h["ticker"] for h in holdings]

    if len(tickers) < 2:
        raise ValueError("Need at least 2 holdings to optimize")

    # fetch live prices
    live_prices = {}
    for ticker in tickers:
        info = yf.Ticker(ticker).fast_info
        live_prices[ticker] = round(float(info.last_price), 2) if info.last_price else None

    # current portfolio value per stock
    current_values = {}
    pnl_per_stock = {}
    for h in holdings:
        ticker = h["ticker"]
        price = live_prices.get(ticker)
        if price:
            market_value = price * h["quantity"]
            cost_basis = h["avg_buy_price"] * h["quantity"]
            current_values[ticker] = market_value
            pnl_per_stock[ticker] = round(market_value - cost_basis, 2)

    total_value = sum(current_values.values())

    # current allocation %
    current_weights = {
        ticker: round(val / total_value, 4)
        for ticker, val in current_values.items()
    }

    # run optimizer
    df = fetch_closing_prices(tickers)
    mu = expected_returns.mean_historical_return(df)
    S = risk_models.sample_cov(df)

    # current portfolio performance
    current_weight_list = [current_weights.get(t, 0) for t in df.columns]
    current_ret = float(mu.values @ current_weight_list)
    current_vol = float((pd.Series(current_weight_list) @ S.values @ pd.Series(current_weight_list)) ** 0.5)
    current_sharpe = round((current_ret) / current_vol, 4)

    # optimized
    ef = EfficientFrontier(mu, S)
    ef.max_sharpe()
    optimized_weights = ef.clean_weights()
    performance = ef.portfolio_performance()

    return {
        "total_portfolio_value": round(total_value, 2),
        "pnl_per_stock": pnl_per_stock,
        "total_pnl": round(sum(pnl_per_stock.values()), 2),
        "current_allocation": current_weights,
        "current_performance": {
            "expected_annual_return": round(current_ret, 4),
            "annual_volatility": round(current_vol, 4),
            "sharpe_ratio": current_sharpe,
        },
        "optimized_allocation": {k: round(v, 4) for k, v in optimized_weights.items()},
        "optimized_performance": {
            "expected_annual_return": round(performance[0], 4),
            "annual_volatility": round(performance[1], 4),
            "sharpe_ratio": round(performance[2], 4),
        },
        "recommendation": "Rebalance your portfolio to the optimized allocation to improve risk-adjusted returns."
    }