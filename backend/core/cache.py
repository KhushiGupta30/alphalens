import redis
import json

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def get_cache(key: str):
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None  # if Redis is down, fail silently

def set_cache(key: str, value, ttl: int = 900):
    try:
        r.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass  # if Redis is down, just skip caching