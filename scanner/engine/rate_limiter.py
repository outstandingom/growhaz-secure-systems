"""
Configurable rate limiter replacing the expensive 1.5–4 second sleep.

Supports per-host limits, concurrency control, and request budgets.
"""

import time
import threading
from collections import defaultdict
from typing import Optional


class RateLimiter:
    """Token-bucket rate limiter with per-host tracking."""

    def __init__(self, requests_per_second: float = 5.0, burst: int = 10):
        """
        Args:
            requests_per_second: Sustained request rate limit.
            burst: Maximum burst size (tokens).
        """
        self.rate = requests_per_second
        self.burst = burst
        self._tokens: float = float(burst)
        self._last_refill = time.monotonic()
        self._lock = threading.Lock()
        self._per_host_last: dict = defaultdict(float)
        self._min_host_interval = 1.0 / requests_per_second

    def acquire(self, host: Optional[str] = None):
        """Wait until a request is allowed, then consume a token.

        This blocks the calling thread if rate limit would be exceeded.
        """
        with self._lock:
            self._refill()
            while self._tokens < 1.0:
                wait_time = (1.0 - self._tokens) / self.rate
                self._lock.release()
                time.sleep(wait_time)
                self._lock.acquire()
                self._refill()

            self._tokens -= 1.0

            # Per-host minimum interval
            if host:
                now = time.monotonic()
                last = self._per_host_last.get(host, 0.0)
                wait = self._min_host_interval - (now - last)
                if wait > 0:
                    self._lock.release()
                    time.sleep(wait)
                    self._lock.acquire()
                self._per_host_last[host] = time.monotonic()

    def _refill(self):
        """Add tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(float(self.burst), self._tokens + elapsed * self.rate)
        self._last_refill = now


class CircuitBreaker:
    """Stops testing an endpoint after repeated blocks."""

    def __init__(self, threshold: int = 3):
        self.threshold = threshold
        self._counters: dict = defaultdict(int)
        self._lock = threading.Lock()

    def record_block(self, endpoint: str):
        """Record that a request to an endpoint was blocked."""
        with self._lock:
            self._counters[endpoint] += 1

    def record_success(self, endpoint: str):
        """Record that a request to an endpoint succeeded."""
        with self._lock:
            self._counters[endpoint] = 0

    def is_tripped(self, endpoint: str) -> bool:
        """Check if the circuit breaker has been tripped for an endpoint."""
        with self._lock:
            return self._counters.get(endpoint, 0) >= self.threshold

    def get_tripped_endpoints(self) -> list:
        """Return list of endpoints where circuit breaker was tripped."""
        with self._lock:
            return [ep for ep, count in self._counters.items()
                    if count >= self.threshold]
