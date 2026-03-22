"""
In-memory session cache for active agent runs.
Uses a simple dict keyed by user_id for short-lived state.
In production, replace with Redis.
"""
import time

_cache: dict = {}
MAX_AGE_SECONDS = 3600  # 1 hour


def set_session(user_id: str, key: str, value) -> None:
    if user_id not in _cache:
        _cache[user_id] = {}
    _cache[user_id][key] = {'value': value, 'ts': time.time()}


def get_session(user_id: str, key: str, default=None):
    session = _cache.get(user_id, {})
    entry = session.get(key)
    if entry is None:
        return default
    if time.time() - entry['ts'] > MAX_AGE_SECONDS:
        del _cache[user_id][key]
        return default
    return entry['value']


def clear_session(user_id: str) -> None:
    _cache.pop(user_id, None)


def get_all_session(user_id: str) -> dict:
    session = _cache.get(user_id, {})
    now = time.time()
    return {k: v['value'] for k, v in session.items() if now - v['ts'] <= MAX_AGE_SECONDS}
