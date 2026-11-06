"""
WAF / Block Detection.

Separates BLOCKED from NOT_VULNERABLE. A blocked payload is NOT evidence
of security — it only means the WAF intercepted the test.
Differentiates between actual WAF mitigation (challenges, IP bans) and standard
application/database JSON errors (e.g. 400 Bad Request with Postgres error syntax).
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
    'security challenge', 'rate limit exceeded',
    'request blocked', 'web application firewall',
    'your ip has been blocked', 'automated request detected',
    'attention required', 'cloudflare ray id',
]

# HTTP status codes indicating potential blocking
BLOCK_STATUS_CODES = {403, 406, 429, 503}


class WAFDetector:
    """Detects WAF/firewall blocking of requests."""

    def __init__(self):
        self.detected_waf: Optional[str] = None
        self.block_count: int = 0
        self.total_requests: int = 0

    def is_blocked(self, status_code: int, headers: dict, body: str) -> bool:
        """Check if a response indicates WAF blocking.

        Returns True if the request was blocked by a WAF/firewall, False otherwise.
        Application JSON errors (Postgres syntax errors, 400 Bad Request, etc.) are NOT WAF blocks.
        """
        self.total_requests += 1

        ct = (headers.get('Content-Type') or headers.get('content-type') or '').lower()
        body_lower = (body or '').lower()

        # 1. JSON responses from API / Database engines (e.g. PostgREST, FastAPI, Django, Express)
        # These are application/database responses, NOT WAF blocks (unless rate limited)
        if 'application/json' in ct:
            if status_code == 429:
                self.block_count += 1
                return True
            if status_code == 403 and any(k in body_lower for k in ('waf', 'blocked by cloudflare', 'ip banned')):
                self.block_count += 1
                return True
            return False

        # 2. Explicit WAF challenge / mitigation headers
        if 'cf-mitigated' in headers:
            self.block_count += 1
            self.detected_waf = 'cloudflare'
            return True

        # 3. Status codes accompanied by block keywords
        if status_code in BLOCK_STATUS_CODES:
            if status_code == 429:
                self.block_count += 1
                return True
            if any(keyword in body_lower for keyword in BLOCK_KEYWORDS):
                self.block_count += 1
                self._detect_waf_from_headers(headers)
                return True

        # 4. Challenge page content in HTML
        if body and len(body) < 30000:
            hit_count = sum(1 for kw in BLOCK_KEYWORDS if kw in body_lower)
            if hit_count >= 2 and status_code >= 400:
                self.block_count += 1
                self._detect_waf_from_headers(headers)
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
            'x-amz-cf-id': 'cloudfront',
            'x-azure-ref': 'azure-front-door',
        }
        for header, waf_name in waf_headers.items():
            if header in headers:
                self.detected_waf = waf_name
                return
