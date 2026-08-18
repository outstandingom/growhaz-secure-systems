"""
Rate Limit + Bypass Detector — checks auth-adjacent endpoints for missing throttling
and header-based bypass techniques.
"""
from typing import List

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel


AUTH_HINTS = ("login", "auth", "signin", "register", "signup", "forgot", "reset", "otp", "verify", "2fa", "token")

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
            if any(h in ep.url.lower() for h in AUTH_HINTS):
                if ep.url not in seen:
                    seen.add(ep.url)
                    targets.append((ep.url, ep.method if ep.method in ("GET", "POST") else "POST"))

        if not targets:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No auth-adjacent endpoints found",
            )

        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for url, method in targets[:5]:
            tested += 1
            hits = 0
            throttled = 0
            for i in range(20):
                r = (engine.post(url, json={"probe": i}) if method == "POST"
                     else engine.get(url, params={"probe": i}))
                if r.is_blocked or r.status_code == 429:
                    throttled += 1
                elif r.has_response:
                    hits += 1

            if throttled == 0 and hits >= 18:
                findings.append(StandardFinding(
                    vulnerability="Missing Rate Limiting",
                    title="Missing Rate Limiting",
                    category=self.category,
                    severity="MEDIUM",
                    confidence=ConfidenceResult(ConfidenceLevel.HIGH, "20/20 rapid requests accepted with no 429"),
                    status=TestState.VULNERABLE,
                    endpoint=url,
                    method=method,
                    cvss=CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L", severity="MEDIUM"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Enforce per-IP + per-account throttling, exponential backoff, and CAPTCHA on repeated failures. Do not trust client-controlled IP headers.",
                    description=f"Sent 20 rapid requests to {url} — none were throttled. This enables credential-stuffing and brute-force attacks.",
                    evidence=[Evidence(description=f"rapid_requests_accepted: 20/20 without 429 at {url}")],
                ))
                continue

            # Bypass test — only meaningful if rate limiter is active
            if throttled >= 3:
                for hdr in BYPASS_HEADERS:
                    passed = 0
                    for _ in range(15):
                        r = (engine.post(url, json={"probe": "b"}, headers=hdr) if method == "POST"
                             else engine.get(url, params={"probe": "b"}, headers=hdr))
                        if not r.is_blocked and r.status_code != 429 and r.has_response:
                            passed += 1
                    if passed >= 12:
                        findings.append(StandardFinding(
                            vulnerability="Rate Limit Bypass via IP Header",
                            title="Rate Limit Bypass via IP Header",
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

        state = (TestState.VULNERABLE if findings
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(
            test_state=state, findings=findings,
            details=f"Probed {tested} auth endpoints. {len(findings)} rate-limit issues.",
            endpoints_tested=tested, endpoints_blocked=blocked,
        )
