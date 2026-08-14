"""
Centralized Request Engine — single reliable request abstraction used by every detector.

Returns structured RequestResult instead of forcing detectors to interpret raw exceptions.
Handles: all HTTP methods, throttling, WAF detection, evidence capture, error classification.
"""

import time
import random
import requests
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from ..models.evidence import RequestEvidence, ResponseEvidence, redact_headers, safe_body_snippet
from .waf_detector import WAFDetector
from .rate_limiter import RateLimiter, CircuitBreaker


# Rotating user agents (proxy header trust testing, not IP spoofing)
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
]


@dataclass
class RequestResult:
    """Structured result from the request engine — no raw exception interpretation needed."""

    # Response data
    status_code: int = 0
    headers: Dict[str, str] = field(default_factory=dict)
    body: str = ""
    elapsed: float = 0.0

    # Classification
    is_blocked: bool = False
    is_error: bool = False
    is_timeout: bool = False
    error_message: str = ""

    # Evidence (pre-redacted)
    request_evidence: Optional[RequestEvidence] = None
    response_evidence: Optional[ResponseEvidence] = None

    @property
    def success(self) -> bool:
        """True if the request completed without error or block."""
        return not self.is_error and not self.is_blocked and not self.is_timeout

    @property
    def has_response(self) -> bool:
        """True if we got an HTTP response (even if error status)."""
        return self.status_code > 0


def _get_default_headers() -> Dict[str, str]:
    """Standard browser-like headers for requests."""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }


class RequestEngine:
    """Centralized HTTP request engine used by all detectors.

    Features:
    - All HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
    - Configurable rate limiting (replaces expensive 1.5-4s sleep)
    - Automatic WAF/block detection
    - Pre-redacted evidence capture
    - Error classification (timeout, connection, blocked)
    - Retry support
    - Circuit breaker per endpoint
    """

    def __init__(
        self,
        session: Optional[requests.Session] = None,
        rate_limiter: Optional[RateLimiter] = None,
        waf_detector: Optional[WAFDetector] = None,
        circuit_breaker: Optional[CircuitBreaker] = None,
        default_timeout: float = 10.0,
        max_retries: int = 1,
        verify_ssl: bool = True,
    ):
        self.session = session or requests.Session()
        self.rate_limiter = rate_limiter or RateLimiter(requests_per_second=5.0)
        self.waf_detector = waf_detector or WAFDetector()
        self.circuit_breaker = circuit_breaker or CircuitBreaker(threshold=3)
        self.default_timeout = default_timeout
        self.max_retries = max_retries
        self.verify_ssl = verify_ssl
        self.total_requests = 0

    def request(
        self,
        method: str,
        url: str,
        params: Optional[Dict] = None,
        data: Optional[Any] = None,
        json: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        cookies: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        allow_redirects: bool = True,
        retries: Optional[int] = None,
    ) -> RequestResult:
        """Execute an HTTP request with full instrumentation.

        This is the ONLY way detectors should make HTTP requests.
        Returns a RequestResult — never raises exceptions to the caller.
        """
        method = method.upper()
        timeout = timeout or self.default_timeout
        retries = retries if retries is not None else self.max_retries

        # Check circuit breaker
        if self.circuit_breaker.is_tripped(url):
            return RequestResult(
                is_blocked=True,
                error_message=f"Circuit breaker tripped for {url}",
                request_evidence=RequestEvidence(method=method, url=url),
            )

        # Build headers
        merged_headers = _get_default_headers()
        # Session headers (e.g., auth tokens)
        merged_headers.update(dict(self.session.headers))
        if headers:
            merged_headers.update(headers)

        # Rate limiting
        host = urlparse(url).netloc
        self.rate_limiter.acquire(host)

        # Attempt request with retries
        last_error = ""
        for attempt in range(retries + 1):
            try:
                self.total_requests += 1
                start_time = time.time()

                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    data=data,
                    json=json,
                    headers=merged_headers,
                    cookies=cookies,
                    timeout=timeout,
                    allow_redirects=allow_redirects,
                    verify=self.verify_ssl,
                )

                elapsed = time.time() - start_time

                # Build evidence
                body_text = ""
                try:
                    body_text = response.text
                except Exception:
                    body_text = "[binary or undecodable response]"

                req_evidence = RequestEvidence(
                    method=method,
                    url=url,
                    headers=dict(merged_headers),
                    body=str(data or json or "")[:500] if (data or json) else None,
                )

                resp_evidence = ResponseEvidence(
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body_snippet=body_text[:500] if body_text else "",
                    elapsed_seconds=elapsed,
                )

                # WAF check
                resp_headers = dict(response.headers)
                blocked = self.waf_detector.is_blocked(
                    response.status_code, resp_headers, body_text
                )

                if blocked:
                    self.circuit_breaker.record_block(url)
                else:
                    self.circuit_breaker.record_success(url)

                return RequestResult(
                    status_code=response.status_code,
                    headers=resp_headers,
                    body=body_text,
                    elapsed=elapsed,
                    is_blocked=blocked,
                    request_evidence=req_evidence,
                    response_evidence=resp_evidence,
                )

            except requests.exceptions.Timeout:
                last_error = f"Request timed out after {timeout}s"
                if attempt < retries:
                    time.sleep(0.5)
                    continue
                return RequestResult(
                    is_timeout=True,
                    is_error=True,
                    error_message=last_error,
                    request_evidence=RequestEvidence(method=method, url=url, headers=dict(merged_headers)),
                )

            except requests.exceptions.ConnectionError as e:
                last_error = f"Connection error: {str(e)[:200]}"
                if attempt < retries:
                    time.sleep(1.0)
                    continue
                return RequestResult(
                    is_error=True,
                    error_message=last_error,
                    request_evidence=RequestEvidence(method=method, url=url, headers=dict(merged_headers)),
                )

            except Exception as e:
                last_error = f"Unexpected error: {type(e).__name__}: {str(e)[:200]}"
                return RequestResult(
                    is_error=True,
                    error_message=last_error,
                    request_evidence=RequestEvidence(method=method, url=url, headers=dict(merged_headers)),
                )

        # Should not reach here, but just in case
        return RequestResult(
            is_error=True,
            error_message=f"All {retries + 1} attempts failed: {last_error}",
            request_evidence=RequestEvidence(method=method, url=url),
        )

    def get(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for GET requests."""
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for POST requests."""
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for PUT requests."""
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for PATCH requests."""
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for DELETE requests."""
        return self.request("DELETE", url, **kwargs)

    def options(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for OPTIONS requests."""
        return self.request("OPTIONS", url, **kwargs)

    def head(self, url: str, **kwargs) -> RequestResult:
        """Convenience method for HEAD requests."""
        return self.request("HEAD", url, **kwargs)

    def get_stats(self) -> dict:
        """Return request engine statistics."""
        return {
            "total_requests": self.total_requests,
            "waf": self.waf_detector.get_summary(),
            "tripped_endpoints": self.circuit_breaker.get_tripped_endpoints(),
        }
