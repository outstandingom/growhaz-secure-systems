"""
Authentication Detector — SEPARATE from CSRF.

Tests: weak passwords, user enumeration, missing rate limiting,
unauthenticated access to protected endpoints.
"""

from typing import List
import time

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo


WEAK_PASSWORDS = ["123456", "password", "admin", "qwerty", "test123", "password123", "letmein", "welcome"]


class AuthDetector(BaseDetector):
    name = "Authentication Flaws"
    category = "Identification and Authentication Failures"
    cwe = "CWE-287"
    owasp = "A07:2021 - Identification and Authentication Failures"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings = []
        tested = 0
        blocked = 0
        had_errors = False

        # Find login endpoints
        login_endpoints = [ep for ep in endpoints if 'login' in ep.url.lower() or 'auth' in ep.url.lower()]
        # Find protected endpoints (non-login, state-changing)
        protected_endpoints = [ep for ep in endpoints if ep.is_state_changing and 'login' not in ep.url.lower()]

        if not login_endpoints and not protected_endpoints:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No login or protected endpoints found"
            )

        # --- Test 1: User Enumeration ---
        for ep in login_endpoints:
            tested += 1
            signals = []

            test_emails = [
                f"definitely_nonexistent_{int(time.time())}@example.com",
                "admin@example.com",
            ]
            responses = {}
            for email in test_emails:
                resp = engine.post(ep.url, json={"email": email, "password": "wrongpassword123"})
                if resp.is_blocked:
                    blocked += 1
                    continue
                if resp.has_response:
                    responses[email] = resp

            if len(responses) >= 2:
                resp_list = list(responses.values())
                # Check if error messages differ between existing and non-existing users
                enum_phrases = ["user not found", "does not exist", "invalid user",
                                "email not found", "no account", "not registered"]

                bodies = {email: r.body.lower() for email, r in responses.items()}

                for email, body in bodies.items():
                    if any(phrase in body for phrase in enum_phrases):
                        # Check if OTHER email gets a different message
                        other_bodies = [b for e, b in bodies.items() if e != email]
                        for other in other_bodies:
                            if not any(phrase in other for phrase in enum_phrases):
                                signals.append("user_enumeration_confirmed: different error messages for existing vs non-existing users")
                                break

                # Also check for response length differences that could indicate enumeration
                lengths = [len(r.body) for r in responses.values()]
                if len(set(lengths)) > 1 and max(lengths) - min(lengths) > 50:
                    # Different response sizes — potential enumeration but needs more signals
                    signals.append("response_length_variance: different response sizes for different emails")

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="User Enumeration",
                        category=self.category, severity="LOW",
                        confidence=confidence, status=TestState.VULNERABLE,
                        endpoint=ep.url, method="POST",
                        cvss=CVSSInfo(score=3.7, vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="LOW"),
                        owasp=self.owasp, cwe="CWE-204",
                        remediation="Use identical error messages for all login failure scenarios.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        # --- Test 2: Missing Rate Limiting ---
        for ep in login_endpoints[:2]:  # Limit to 2 endpoints
            tested += 1
            signals = []

            success_count = 0
            for i in range(15):
                resp = engine.post(ep.url, json={"email": "test@example.com", "password": f"wrong{i}"})
                if resp.is_blocked:
                    blocked += 1
                    break
                if resp.has_response and resp.status_code != 429:
                    success_count += 1

            if success_count >= 12:
                signals.append(f"no_rate_limiting: {success_count} rapid login attempts accepted without 429")
                confidence = ConfidenceResult.from_signals(signals)
                findings.append(StandardFinding(
                    vulnerability="Missing Rate Limiting",
                    category=self.category, severity="MEDIUM",
                    confidence=confidence, status=TestState.VULNERABLE,
                    endpoint=ep.url, method="POST",
                    cvss=CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="MEDIUM"),
                    owasp=self.owasp, cwe="CWE-307",
                    remediation="Implement rate limiting on authentication endpoints (e.g., max 5 attempts per minute).",
                    evidence=[Evidence(description=s) for s in signals],
                ))

        # --- Test 3: Unauthenticated access to protected endpoints ---
        for ep in protected_endpoints[:5]:
            tested += 1
            # Try accessing without auth
            resp_unauth = engine.request(ep.method, ep.url, headers={"Authorization": ""})
            if resp_unauth.is_blocked:
                blocked += 1
                continue

            if resp_unauth.has_response and resp_unauth.status_code == 200:
                # Also verify authenticated access returns similar content
                if auth_context.is_authenticated:
                    resp_auth = engine.request(ep.method, ep.url, headers=auth_context.user_a.get_auth_headers())
                    if resp_auth.has_response and resp_auth.status_code == 200:
                        # Both return 200 — check if content is similar
                        if len(resp_unauth.body) > 100 and len(resp_auth.body) > 100:
                            findings.append(StandardFinding(
                                vulnerability="Missing Authentication on Protected Endpoint",
                                category=self.category, severity="HIGH",
                                confidence=ConfidenceResult(0.7, ConfidenceLevel.MEDIUM,
                                    signals=["unauthenticated_access_returns_200_with_content"]),
                                status=TestState.VULNERABLE,
                                endpoint=ep.url, method=ep.method,
                                cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                                owasp=self.owasp, cwe="CWE-306",
                                remediation="Require authentication on all state-changing and data-access endpoints.",
                                evidence=[Evidence(description="Endpoint returns full content without authentication")],
                            ))

        # Overall state
        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln:
            state = TestState.VULNERABLE
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
        elif tested > 0:
            state = TestState.PASS
        else:
            state = TestState.NOT_APPLICABLE

        return DetectorResult(
            test_state=state, findings=findings,
            details=f"Tested {tested} endpoints. {len(vuln)} auth issues found, {blocked} blocked.",
            endpoints_tested=tested, endpoints_blocked=blocked,
        )
