"""Simple in-memory rate limiting for sensitive endpoints (brute-force guard).

Best-effort protection for a single-process deployment. For multi-worker or
multi-instance setups, replace with a shared store (e.g. Redis).
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from src.core.config import get_settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: float) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                )
            hits.append(now)


_limiter = InMemoryRateLimiter()


def auth_rate_limit(request: Request) -> None:
    """FastAPI dependency limiting auth attempts per client IP."""
    limit = get_settings().RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    client_host = request.client.host if request.client else "unknown"
    _limiter.check(f"auth:{client_host}", limit=limit, window_seconds=60.0)


def chat_rate_limit(request: Request) -> None:
    """FastAPI dependency limiting chat messages per client IP."""
    limit = get_settings().CHAT_RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    client_host = request.client.host if request.client else "unknown"
    _limiter.check(f"chat:{client_host}", limit=limit, window_seconds=60.0)
