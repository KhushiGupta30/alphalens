import yfinance as yf
import pandas as pd
import ta
from core.cache import get_cache, set_cache


def fetch_stock_data(ticker: str, period: str = "2y") -> pd.DataFrame:
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period)
        if df.empty:
            raise ValueError(f"No data found for ticker: {ticker}")
        df = df.drop(columns=['Dividends', 'Stock Splits'])
        df.index = df.index.tz_localize(None)
        df = df.ffill()
        return df
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return pd.DataFrame()


def fetch_stock_info(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        overview = {
            "ticker": ticker,
            "name": info.get("longName", ticker),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose"),
            "percent_change": None,
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "week_52_high": info.get("fiftyTwoWeekHigh"),
            "week_52_low": info.get("fiftyTwoWeekLow"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
        }
        if overview["current_price"] and overview["previous_close"]:
            change = overview["current_price"] - overview["previous_close"]
            overview["percent_change"] = round((change / overview["previous_close"]) * 100, 2)
        return overview
    except Exception as e:
        print(f"Error fetching info for {ticker}: {e}")
        return {}


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df['RSI'] = ta.momentum.RSIIndicator(close=df['Close'], window=14).rsi()

    macd = ta.trend.MACD(close=df['Close'], window_slow=26, window_fast=12, window_sign=9)
    df['MACD'] = macd.macd()
    df['MACD_signal'] = macd.macd_signal()
    df['MACD_histogram'] = macd.macd_diff()

    bb = ta.volatility.BollingerBands(close=df['Close'], window=20, window_dev=2)
    df['BB_upper'] = bb.bollinger_hband()
    df['BB_mid'] = bb.bollinger_mavg()
    df['BB_lower'] = bb.bollinger_lband()
    df['BB_width'] = bb.bollinger_wband()

    df['SMA_50'] = ta.trend.SMAIndicator(close=df['Close'], window=50).sma_indicator()
    df['SMA_200'] = ta.trend.SMAIndicator(close=df['Close'], window=200).sma_indicator()
    df['EMA_12'] = ta.trend.EMAIndicator(close=df['Close'], window=12).ema_indicator()
    df['EMA_26'] = ta.trend.EMAIndicator(close=df['Close'], window=26).ema_indicator()

    return df


def get_overview(ticker: str) -> dict:
    cache_key = f"overview:{ticker}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    info = fetch_stock_info(ticker)
    if not info:
        raise ValueError(f"Ticker not found: {ticker}")

    df = fetch_stock_data(ticker, period="6mo")
    if df.empty:
        raise ValueError(f"No price data for: {ticker}")

    df = compute_indicators(df)
    latest = df.iloc[-1]

    result = {
        **info,
        "rsi": round(float(latest["RSI"]), 2) if pd.notna(latest["RSI"]) else None,
        "macd": round(float(latest["MACD"]), 4) if pd.notna(latest["MACD"]) else None,
        "macd_signal": round(float(latest["MACD_signal"]), 4) if pd.notna(latest["MACD_signal"]) else None,
        "sma_50": round(float(latest["SMA_50"]), 2) if pd.notna(latest["SMA_50"]) else None,
        "sma_200": round(float(latest["SMA_200"]), 2) if pd.notna(latest["SMA_200"]) else None,
    }

    set_cache(cache_key, result, ttl=900)
    return result


def get_technicals(ticker: str) -> list:
    cache_key = f"technicals:{ticker}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    df = fetch_stock_data(ticker, period="1y")
    if df.empty:
        raise ValueError(f"No data for: {ticker}")

    df = compute_indicators(df)
    df = df.tail(200).reset_index()
    df["Date"] = df["Date"].astype(str)

    cols = ["Date", "Close", "High", "Low", "Open", "Volume",
            "RSI", "MACD", "MACD_signal", "MACD_histogram",
            "BB_upper", "BB_mid", "BB_lower",
            "SMA_50", "SMA_200", "EMA_12", "EMA_26"]

    result = df[cols].fillna(0).round(4).to_dict(orient="records")
    set_cache(cache_key, result, ttl=900)
    return result