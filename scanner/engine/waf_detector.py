"""
WAF / Block Detection.

Separates BLOCKED from NOT_VULNERABLE. A blocked payload is NOT evidence
of security — it only means the WAF intercepted the test.
"""

import re
from typing import Optional


# WAF server header signatures
WAF_SIGNATURES = [
    'cloudflare', 'akamai', 'datadome', 'incapsula', 'aws-waf',
    'cloudfront', 'barracuda', 'f5', 'imperva', 'sucuri',
    'fortiweb', 'modsecurity', 'wallarm',
]

# Block page content indicators
BLOCK_KEYWORDS = [
    'captcha', 'access denied', 'please verify you are a human',
    'security challenge', 'blocked', 'rate limit exceeded',
    'request blocked', 'forbidden', 'web application firewall',
    'your ip has been blocked', 'automated request detected',
]

# HTTP status codes indicating blocking
BLOCK_STATUS_CODES = {403, 406, 429, 503}


class WAFDetector:
    """Detects WAF/firewall blocking of requests."""

    def __init__(self):
        self.detected_waf: Optional[str] = None
        self.block_count: int = 0
        self.total_requests: int = 0

    def is_blocked(self, status_code: int, headers: dict, body: str) -> bool:
        """Check if a response indicates WAF blocking.

        Returns True if the request was blocked, False otherwise.
        """
        self.total_requests += 1

        # Status code check
        if status_code in BLOCK_STATUS_CODES:
            self.block_count += 1
            self._detect_waf_from_headers(headers)
            return True

        # WAF server header + error status
        server = headers.get('Server', '').lower()
        if any(waf in server for waf in WAF_SIGNATURES) and status_code >= 400:
            self.block_count += 1
            self._detect_waf_from_headers(headers)
            return True

        # Block page content (only check for short responses to avoid scanning
        # large legitimate pages)
        if body and len(body) < 50000:
            body_lower = body.lower()
            if any(keyword in body_lower for keyword in BLOCK_KEYWORDS):
                # Require at least 2 block indicators to reduce false positives
                # from pages that legitimately contain words like "blocked"
                hit_count = sum(1 for kw in BLOCK_KEYWORDS if kw in body_lower)
                if hit_count >= 2 or status_code >= 400:
                    self.block_count += 1
                    return True

        return False

    def _detect_waf_from_headers(self, headers: dict):
        """Try to identify which WAF is in use."""
        server = headers.get('Server', '').lower()
        for waf in WAF_SIGNATURES:
            if waf in server:
                self.detected_waf = waf
                return

        # Check common WAF-specific headers
        waf_headers = {
            'cf-ray': 'cloudflare',
            'x-sucuri-id': 'sucuri',
            'x-datadome': 'datadome',
            'x-akamai-session': 'akamai',
        }
        for header, waf_name in waf_headers.items():
            if header.lower() in {k.lower() for k in headers}:
                self.detected_waf = waf_name
                return

    @property
    def block_rate(self) -> float:
        """Percentage of requests that were blocked."""
        if self.total_requests == 0:
            return 0.0
        return self.block_count / self.total_requests

    def get_summary(self) -> dict:
        return {
            "detected_waf": self.detected_waf,
            "total_requests": self.total_requests,
            "blocked_requests": self.block_count,
            "block_rate": round(self.block_rate, 2),
        }
