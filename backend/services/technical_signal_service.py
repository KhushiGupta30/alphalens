from services.stock_service import get_overview
from core.cache import get_cache, set_cache


def score_rsi(rsi: float) -> int:
    if rsi < 30: return 2       # oversold — bullish
    if rsi < 45: return 1       # leaning bullish
    if rsi > 70: return -2      # overbought — bearish
    if rsi > 55: return -1      # leaning bearish
    return 0

def score_macd(macd: float, macd_signal: float) -> int:
    if macd > macd_signal: return 2    # bullish crossover
    if macd < macd_signal: return -2   # bearish crossover
    return 0

def score_sma(price: float, sma_50: float, sma_200: float) -> int:
    score = 0
    if sma_50 and price > sma_50: score += 1    # price above 50 SMA — bullish
    if sma_50 and price < sma_50: score -= 1
    if sma_200 and price > sma_200: score += 1  # price above 200 SMA — bullish
    if sma_200 and price < sma_200: score -= 1
    if sma_50 and sma_200 and sma_50 > sma_200: score += 1   # golden cross
    if sma_50 and sma_200 and sma_50 < sma_200: score -= 1   # death cross
    return score


def get_technical_signal(ticker: str) -> dict:
    cache_key = f"technical_signal:{ticker}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    overview = get_overview(ticker)

    rsi = overview.get("rsi")
    macd = overview.get("macd")
    macd_signal = overview.get("macd_signal")
    sma_50 = overview.get("sma_50")
    sma_200 = overview.get("sma_200")
    price = overview.get("current_price")

    if rsi is None or macd is None:
        raise ValueError("Not enough indicator data")

    score = 0
    reasons = []

    rsi_score = score_rsi(rsi)
    score += rsi_score
    if rsi_score >= 2: reasons.append(f"RSI {rsi} — oversold")
    elif rsi_score == 1: reasons.append(f"RSI {rsi} — leaning bullish")
    elif rsi_score <= -2: reasons.append(f"RSI {rsi} — overbought")
    elif rsi_score == -1: reasons.append(f"RSI {rsi} — leaning bearish")

    macd_score = score_macd(macd, macd_signal)
    score += macd_score
    if macd_score > 0: reasons.append("MACD above signal line")
    elif macd_score < 0: reasons.append("MACD below signal line")

    sma_score = score_sma(price, sma_50, sma_200)
    score += sma_score
    if sma_50 and sma_200:
        if sma_50 > sma_200: reasons.append("Golden cross — SMA50 above SMA200")
        else: reasons.append("Death cross — SMA50 below SMA200")

    if score >= 3:
        decision = "BUY"
    elif score <= -3:
        decision = "SELL"
    else:
        decision = "HOLD"

    result = {
        "ticker": ticker,
        "decision": decision,
        "score": score,
        "reasons": reasons,
        "indicators": {
            "rsi": rsi,
            "macd": macd,
            "macd_signal": macd_signal,
            "sma_50": sma_50,
            "sma_200": sma_200,
        },
        "disclaimer": "Technical analysis only — not financial advice"
    }

    set_cache(cache_key, result, ttl=900)
    return result