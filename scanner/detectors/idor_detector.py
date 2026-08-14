"""
IDOR/BOLA Detector — identity-aware, cross-user authorization testing.

NEVER reports IDOR solely because HTTP 200 + word 'email' in body.
Requires two-user auth context for proper testing.
"""

from typing import List

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo

import re

# Patterns for IDOR-prone endpoints
IDOR_PATH_PATTERNS = [
    r'/users?/\d+', r'/profiles?/\d+', r'/orders?/\d+',
    r'/documents?/\d+', r'/payments?/\d+', r'/accounts?/\d+',
    r'/api/v\d+/\w+/\d+', r'/\w+/\{id\}',
]

IDOR_URL_KEYWORDS = [
    '/user/', '/profile/', '/order/', '/document/',
    '/payment/', '/account/', '/api/users/', '/api/orders/',
    '/api/documents/', '/api/accounts/',
]


class IDORDetector(BaseDetector):
    name = "Insecure Direct Object Reference (IDOR)"
    category = "Broken Access Control"
    cwe = "CWE-639"
    owasp = "A01:2021 - Broken Access Control"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings = []
        tested = 0
        blocked = 0

        # Find IDOR-candidate endpoints
        idor_endpoints = []
        for ep in endpoints:
            url_lower = ep.url.lower()
            if any(kw in url_lower for kw in IDOR_URL_KEYWORDS):
                idor_endpoints.append(ep)
            elif any(re.search(p, ep.url) for p in IDOR_PATH_PATTERNS):
                idor_endpoints.append(ep)
            elif ep.path_params:
                idor_endpoints.append(ep)

        if not idor_endpoints:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No IDOR-candidate endpoints found"
            )

        if not auth_context.has_two_users:
            return DetectorResult(
                test_state=TestState.INCONCLUSIVE,
                details="Two-user auth context required for proper IDOR testing. "
                        "Set TEST_EMAIL_B and TEST_PASSWORD_B environment variables."
            )

        # Create sessions for both users
        import requests as req_lib
        session_a = req_lib.Session()
        auth_context.apply_auth(session_a, auth_context.user_a)

        session_b = req_lib.Session()
        auth_context.apply_auth(session_b, auth_context.user_b)

        for ep in idor_endpoints:
            tested += 1
            signals = []

            # Step 1: Access as User A (owner)
            result_a = engine.request(
                ep.method, ep.url,
                headers=auth_context.user_a.get_auth_headers()
            )

            if result_a.is_blocked:
                blocked += 1
                continue
            if not result_a.has_response:
                continue
            if result_a.status_code >= 400:
                continue  # User A can't access either — skip

            # Step 2: Access same resource as User B
            result_b = engine.request(
                ep.method, ep.url,
                headers=auth_context.user_b.get_auth_headers()
            )

            if result_b.is_blocked:
                blocked += 1
                continue
            if not result_b.has_response:
                continue

            # Step 3: Compare responses
            if result_b.status_code == 200:
                # Both got 200 — but is the CONTENT the same?
                # If User B sees User A's data, that's IDOR
                if result_a.body and result_b.body:
                    # Check if substantial content overlap (not just shared templates)
                    from ..engine.baseline import BaselineProfile
                    body_a_words = set(result_a.body.lower().split())
                    body_b_words = set(result_b.body.lower().split())

                    if body_a_words and body_b_words:
                        overlap = len(body_a_words & body_b_words) / max(len(body_a_words), 1)

                        if overlap > 0.8:
                            signals.append(
                                f"cross_user_access_confirmed: User B received User A's data "
                                f"(similarity={overlap:.2f})"
                            )

                        # Check if User A's unique identifiers appear in User B's response
                        if auth_context.user_a.identifier and auth_context.user_a.identifier in result_b.body:
                            signals.append(
                                f"cross_user_access_confirmed: User A's identifier found in User B's response"
                            )

            elif result_b.status_code in (401, 403):
                # Properly denied — not IDOR
                pass
            elif result_b.status_code == 404:
                # Resource not found for User B — might be proper isolation
                pass

            # Step 4: Test unauthenticated access
            result_unauth = engine.request(ep.method, ep.url, headers={})
            if result_unauth.has_response and result_unauth.status_code == 200:
                if result_a.body and result_unauth.body:
                    overlap = len(set(result_a.body.lower().split()) & set(result_unauth.body.lower().split())) / max(len(set(result_a.body.lower().split())), 1)
                    if overlap > 0.7:
                        signals.append(
                            f"cross_user_access_confirmed: Unauthenticated access returns owner data"
                        )

            # Evaluate
            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                if confidence.level in (ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="Insecure Direct Object Reference (IDOR)",
                        category="Broken Access Control",
                        severity="HIGH",
                        confidence=confidence,
                        status=TestState.VULNERABLE,
                        endpoint=ep.url,
                        method=ep.method,
                        cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Implement server-side authorization checks on every resource access. "
                                    "Verify the requesting user owns or is authorized to access the resource.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))
                elif confidence.level == ConfidenceLevel.MEDIUM:
                    findings.append(StandardFinding(
                        vulnerability="IDOR (Possible)",
                        category="Broken Access Control",
                        severity="MEDIUM",
                        confidence=confidence,
                        status=TestState.INCONCLUSIVE,
                        endpoint=ep.url,
                        method=ep.method,
                        owasp=self.owasp, cwe=self.cwe,
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        # Overall state
        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln:
            state = TestState.VULNERABLE
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
        elif any(f.status == TestState.INCONCLUSIVE for f in findings):
            state = TestState.INCONCLUSIVE
        elif tested > 0:
            state = TestState.PASS
        else:
            state = TestState.NOT_APPLICABLE

        return DetectorResult(
            test_state=state, findings=findings,
            details=f"Tested {tested} endpoints. {len(vuln)} IDOR confirmed, {blocked} blocked.",
            endpoints_tested=tested, endpoints_blocked=blocked,
        )
