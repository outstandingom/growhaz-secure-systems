"""
Evidence model with automatic redaction of sensitive data.

Never store complete sensitive responses unnecessarily.
Redact: Authorization, Cookie, Set-Cookie, API keys, passwords, secrets, tokens.
"""

import re
import copy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# Headers that must always be redacted
REDACTED_HEADERS = {
    "authorization", "cookie", "set-cookie", "x-api-key",
    "x-auth-token", "proxy-authorization", "www-authenticate",
}

# Regex patterns for sensitive values in bodies/URLs
SENSITIVE_PATTERNS = [
    (re.compile(r'(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|session[_-]?id)'
                r'\s*[=:]\s*["\']?([^"\'&\s,}{]{3,})', re.IGNORECASE), r'\1=[REDACTED]'),
    (re.compile(r'(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)'), '[REDACTED_JWT]'),
    (re.compile(r'(mongodb\+srv://|mysql://|postgresql://|redis://)([^@\s]+)@'), r'\1[REDACTED]@'),
]

MAX_BODY_SNIPPET = 500


def redact_sensitive(value: Any) -> Any:
    """Recursively redact sensitive data from a value."""
    if isinstance(value, str):
        return _redact_string(value)
    elif isinstance(value, dict):
        return _redact_dict(value)
    elif isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value


def _redact_string(text: str) -> str:
    """Apply regex-based redaction to a string."""
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def _redact_dict(d: dict) -> dict:
    """Redact sensitive headers and values from a dictionary."""
    result = {}
    for key, value in d.items():
        if key.lower() in REDACTED_HEADERS:
            result[key] = "[REDACTED]"
        else:
            result[key] = redact_sensitive(value)
    return result


def redact_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """Redact sensitive headers, returning a new dict."""
    return _redact_dict(headers)


def safe_body_snippet(body: str, max_length: int = MAX_BODY_SNIPPET) -> str:
    """Truncate and redact a response body for evidence storage."""
    if not body:
        return ""
    snippet = body[:max_length]
    if len(body) > max_length:
        snippet += f"... [truncated, {len(body)} total bytes]"
    return _redact_string(snippet)


@dataclass
class RequestEvidence:
    """Captured HTTP request details (redacted)."""
    method: str = ""
    url: str = ""
    headers: Dict[str, str] = field(default_factory=dict)
    body: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "url": _redact_string(self.url),
            "headers": redact_headers(self.headers),
            "body": _redact_string(self.body) if self.body else None,
        }


@dataclass
class ResponseEvidence:
    """Captured HTTP response details (redacted)."""
    status_code: int = 0
    headers: Dict[str, str] = field(default_factory=dict)
    body_snippet: str = ""
    elapsed_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "status_code": self.status_code,
            "headers": redact_headers(self.headers),
            "body_snippet": safe_body_snippet(self.body_snippet),
            "elapsed_seconds": round(self.elapsed_seconds, 3),
        }


@dataclass
class Evidence:
    """A single piece of evidence for a finding."""
    description: str = ""
    request: Optional[RequestEvidence] = None
    response: Optional[ResponseEvidence] = None
    baseline_comparison: Optional[Dict[str, Any]] = None
    payload: str = ""
    parameter: str = ""

    def to_dict(self) -> dict:
        result = {"description": self.description}
        if self.request:
            result["request"] = self.request.to_dict()
        if self.response:
            result["response"] = self.response.to_dict()
        if self.baseline_comparison:
            result["baseline_comparison"] = redact_sensitive(self.baseline_comparison)
        if self.payload:
            result["payload"] = self.payload
        if self.parameter:
            result["parameter"] = self.parameter
        return result
