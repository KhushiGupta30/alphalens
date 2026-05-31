import feedparser
import requests
import os

BLOCKED_SOURCES = ["facebook.com", "twitter.com", "instagram.com", "reddit.com"]

HF_TOKEN = os.getenv("HF_TOKEN")
HF_API_URL = "https://khushig30-alphalens-finbert.hf.space/analyze"


def query_finbert(texts: list) -> list:
    response = requests.post(
        HF_API_URL,
        json={"inputs": texts},
        timeout=60
    )
    response.raise_for_status()
    return response.json()


def fetch_headlines(company_name: str) -> list:
    try:
        query = company_name.replace(" ", "+")
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        feed = feedparser.parse(url)
        if not feed.entries:
            return []
        headlines = [
            {
                "title": entry.title,
                "published_at": entry.published,
                "source": entry.source.get("title", "Google News") if hasattr(entry, "source") else "Google News"
            }
            for entry in feed.entries[:15]
            if not any(
                blocked in (entry.source.get("title", "") if hasattr(entry, "source") else "").lower()
                for blocked in BLOCKED_SOURCES
            )
        ]
        return headlines
    except Exception as e:
        print(f"Error fetching news: {e}")
        return []


def get_sentiment(company_name: str) -> dict:
    from core.cache import get_cache, set_cache

    cache_key = f"sentiment:{company_name}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    headlines = fetch_headlines(company_name)
    if not headlines:
        return {"error": "No headlines found", "company": company_name}

    titles = [h["title"] for h in headlines]

    try:
        hf_results = query_finbert(titles)
    except Exception as e:
        print(f"HuggingFace API error: {e}")
        return {"error": "Sentiment analysis unavailable", "company": company_name}

    results = []
    for i, h in enumerate(headlines):
        try:
            # HF returns list of scores per input — pick highest
            scores = hf_results[i]
            top = max(scores, key=lambda x: x["score"])
            results.append({
                "title": h["title"],
                "source": h["source"],
                "published_at": h["published_at"],
                "sentiment": top["label"].lower(),
                "confidence": round(top["score"], 3)
            })
        except Exception:
            continue

    if not results:
        return {"error": "Sentiment analysis failed", "company": company_name}

    sentiment_map = {"positive": 1, "negative": -1, "neutral": 0}
    aggregate = sum(
        sentiment_map.get(r["sentiment"], 0) * r["confidence"] for r in results
    ) / len(results)

    overall = "BULLISH" if aggregate > 0.1 else ("BEARISH" if aggregate < -0.1 else "NEUTRAL")

    result = {
        "company": company_name,
        "headlines_analyzed": len(results),
        "aggregate_score": round(aggregate, 3),
        "overall_sentiment": overall,
        "headlines": results
    }

    set_cache(cache_key, result, ttl=3600)
    return result