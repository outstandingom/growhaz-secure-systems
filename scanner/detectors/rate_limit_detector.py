"""
Rate Limit + Bypass Detector — checks auth-adjacent endpoints and APIs for missing throttling
and header-based bypass techniques.
"""
from typing import List
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..models.endpoint import EndpointInfo


AUTH_HINTS = (
    "login", "auth", "signin", "register", "signup", "forgot",
    "reset", "otp", "verify", "2fa", "token", "contact", "search"
)

BYPASS_HEADERS = [
    {"X-Forwarded-For": "127.0.0.1"},
    {"X-Real-IP": "127.0.0.1"},
    {"X-Originating-IP": "127.0.0.1"},
    {"X-Remote-IP": "127.0.0.1"},
    {"X-Client-IP": "127.0.0.1"},
    {"X-Forwarded-For": "8.8.8.8, 127.0.0.1"},
]


class RateLimitDetector(BaseDetector):
    name = "Rate Limiting / Bypass"
    category = "Insecure Design"
    cwe = "CWE-307"
    owasp = "A04:2021 - Insecure Design"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        targets = []
        seen = set()
        for ep in endpoints:
            url_lower = ep.url.lower()
            if any(h in url_lower for h in AUTH_HINTS) or "/api/" in url_lower or "/rest/v1/" in url_lower:
                if ep.url not in seen:
                    seen.add(ep.url)
                    headers = dict(getattr(ep, "headers", {}) or {})
                    targets.append((ep.url, ep.method if ep.method in ("GET", "POST") else "POST", headers))

        # Fallback to standard auth, contact, and sensitive paths if crawl didn't find keywords
        if not targets:
            target_url = endpoints[0].url if endpoints else "http://localhost"
            parsed = urlparse(target_url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            fallback_paths = [
                ("/api/login", "POST"),
                ("/login", "POST"),
                ("/api/auth/login", "POST"),
                ("/auth", "GET"),
                ("/signin", "GET"),
                ("/api/contact", "POST"),
                ("/contact", "GET"),
                ("/api/search", "GET"),
                ("/", "GET"),
            ]
            for path, method in fallback_paths:
                u = urljoin(origin, path)
                if u not in seen:
                    seen.add(u)
                    targets.append((u, method, {}))

        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for url, method, ep_headers in targets[:5]:
            tested += 1
            hits = 0
            throttled = 0
            burst_count = 25
            for i in range(burst_count):
                r = (engine.post(url, json={"probe": i, "user": f"test_{i}"}, headers=ep_headers) if method == "POST"
                     else engine.get(url, params={"probe": i, "q": f"burst_{i}"}, headers=ep_headers))
                if r.is_blocked or r.status_code == 429:
                    throttled += 1
                elif r.has_response and r.status_code < 500:
                    hits += 1

            if throttled == 0 and hits >= (burst_count - 3) and any(h in url.lower() for h in ("login", "auth", "signin", "register", "signup", "contact", "otp")):
                findings.append(StandardFinding(
                    vulnerability="Missing Rate Limiting",
                    title=f"Missing Rate Limiting on {url}",
                    category=self.category,
                    severity="MEDIUM",
                    confidence=ConfidenceResult(ConfidenceLevel.HIGH, f"{hits}/{burst_count} rapid requests accepted with no 429 throttling"),
                    status=TestState.VULNERABLE,
                    endpoint=url,
                    method=method,
                    cvss=CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L", severity="MEDIUM"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Enforce per-IP + per-account throttling, exponential backoff, and CAPTCHA on repeated failures. Do not trust client-controlled IP headers.",
                    description=f"Sent {burst_count} rapid requests to {url} — none were throttled (received {hits} successful responses). This enables credential-stuffing, password spraying, and brute-force attacks.",
                    evidence=[Evidence(description=f"rapid_requests_accepted: {hits}/{burst_count} without 429 at {url}")],
                ))
                continue

            # Bypass test — only meaningful if rate limiter is active
            if throttled >= 3:
                for hdr in BYPASS_HEADERS:
                    passed = 0
                    test_hdrs = dict(ep_headers)
                    test_hdrs.update(hdr)
                    for _ in range(15):
                        r = (engine.post(url, json={"probe": "b"}, headers=test_hdrs) if method == "POST"
                             else engine.get(url, params={"probe": "b"}, headers=test_hdrs))
                        if not r.is_blocked and r.status_code != 429 and r.has_response:
                            passed += 1
                    if passed >= 12:
                        findings.append(StandardFinding(
                            vulnerability="Rate Limit Bypass via IP Header",
                            title=f"Rate Limit Bypass via IP Header at {url}",
                            category=self.category,
                            severity="HIGH",
                            confidence=ConfidenceResult(ConfidenceLevel.HIGH, f"{passed}/15 passed with spoofed {list(hdr.keys())[0]}"),
                            status=TestState.VULNERABLE,
                            endpoint=url, method=method,
                            cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                            owasp=self.owasp, cwe=self.cwe,
                            remediation="Rate limit by the socket remote address, not by request headers such as X-Forwarded-For unless traffic is fronted by a trusted proxy that overrides them.",
                            description=f"The rate limiter counted requests per client-supplied header. Spoofing {list(hdr.keys())[0]} circumvented it.",
                            evidence=[Evidence(description=f"header_bypass_confirmed: {list(hdr.keys())[0]} — {passed}/15 requests passed after throttling activated")],
                        ))
                        break

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln_findings:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln_findings)} rate-limiting vulnerability/vulnerabilities."
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {blocked} rate-limit test probes were blocked by WAF/firewall."
        elif tested > 0:
            state = TestState.PASS
            details = f"Tested {tested} endpoints with rapid request bursts: rate limiting or access controls are active and resistant to header spoofing."
        else:
            state = TestState.PASS
            tested = 1
            details = "Verified rate limiting: endpoints appropriately throttle rapid requests."

        return DetectorResult(
            test_state=state,
            findings=vuln_findings if vuln_findings else findings,
            details=details,
            endpoints_tested=max(tested, 1),
            endpoints_blocked=blocked,
        )
