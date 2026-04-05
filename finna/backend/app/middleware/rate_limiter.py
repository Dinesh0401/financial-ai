from __future__ import annotations

import time
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


@dataclass
class Bucket:
    tokens: float
    last_refill: float


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, rate_limit_per_minute: int) -> None:
        super().__init__(app)
        self.capacity = float(rate_limit_per_minute)
        self.refill_rate = self.capacity / 60.0
        self.buckets: dict[str, Bucket] = {}

    def _consume(self, key: str) -> bool:
        now = time.monotonic()
        bucket = self.buckets.get(key)
        if bucket is None:
            bucket = Bucket(tokens=self.capacity, last_refill=now)
            self.buckets[key] = bucket

        elapsed = now - bucket.last_refill
        bucket.tokens = min(self.capacity, bucket.tokens + elapsed * self.refill_rate)
        bucket.last_refill = now

        if bucket.tokens < 1:
            return False
        bucket.tokens -= 1
        return True

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        if not self._consume(client_ip):
            return JSONResponse(
                status_code=429,
                content={
                    "type": "about:blank",
                    "title": "Too Many Requests",
                    "status": 429,
                    "detail": "Rate limit exceeded.",
                    "instance": str(request.url.path),
                },
            )
        return await call_next(request)

