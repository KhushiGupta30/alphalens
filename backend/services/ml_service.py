import joblib
import os
import yfinance as yf
import pandas as pd
import ta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "price_model.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "ml", "features.pkl")

# lazy load — don't load at import time, load on first request
_model = None
_features = None

def get_model():
    global _model, _features
    if _model is None:
        print("Loading XGBoost model...")
        _model = joblib.load(MODEL_PATH)
        _features = joblib.load(FEATURES_PATH)
        print("ML model ready.")
    return _model, _features


def build_feature_dataframe(ticker: str, period: str = "5y") -> pd.DataFrame:
    t = yf.Ticker(ticker)
    df = t.history(period=period)
    df = df.drop(columns=['Dividends', 'Stock Splits'])
    df.index = df.index.tz_localize(None)
    df = df.ffill()

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

    df['Price_vs_SMA50'] = (df['Close'] - df['SMA_50']) / df['SMA_50']
    df['Price_vs_SMA200'] = (df['Close'] - df['SMA_200']) / df['SMA_200']
    df['Price_vs_BB_mid'] = (df['Close'] - df['BB_mid']) / df['BB_mid']
    df['BB_position'] = (df['Close'] - df['BB_lower']) / (df['BB_upper'] - df['BB_lower'])
    df['Return_1d'] = df['Close'].pct_change(1)
    df['Return_5d'] = df['Close'].pct_change(5)
    df['Return_10d'] = df['Close'].pct_change(10)
    df['RSI_change'] = df['RSI'].diff(3)
    df['MACD_hist_change'] = df['MACD_histogram'].diff(3)
    df['Volume_SMA20'] = df['Volume'].rolling(20).mean()
    df['Volume_ratio'] = df['Volume'] / df['Volume_SMA20']

    return df.dropna()


def get_signal(ticker: str) -> dict:
    try:
        model, FEATURES = get_model()

        df = build_feature_dataframe(ticker)
        if df.empty:
            raise ValueError(f"No data for {ticker}")

        latest = df[FEATURES].iloc[[-1]]
        proba = model.predict_proba(latest)[0]
        pred = model.predict(latest)[0]

        signal = "UP" if pred == 1 else "DOWN"
        confidence = float(proba[int(pred)])

        return {
            "ticker": ticker,
            "signal": signal,
            "confidence": round(confidence, 3),
            "disclaimer": "ML signal only — not financial advice"
        }
    except Exception as e:
        raise ValueError(f"Signal prediction failed: {e}")