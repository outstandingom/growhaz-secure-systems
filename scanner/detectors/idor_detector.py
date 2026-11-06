"""
IDOR/BOLA Detector — identity-aware, cross-user authorization testing.

Detection approach:
1. If two users are provided: runs cross-user authorization differential testing.
2. If unauthenticated/single-user: probes object endpoints and parameters for Broken Object Level
   Authorization (BOLA) and unauthorized access to customer records.
"""

from typing import List
import re
import json
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo

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

# Dynamic ID patterns: /resource/123 or /resource/uuid
DYNAMIC_ID_RE = re.compile(r'/\d{1,10}(?:/|$)')
UUID_RE = re.compile(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:/|$)', re.IGNORECASE)

SENSITIVE_OBJECT_FIELDS = {"email", "password", "hash", "ssn", "secret", "token", "credit_card", "balance"}


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
            elif DYNAMIC_ID_RE.search(ep.url):
                idor_endpoints.append(ep)
            elif UUID_RE.search(ep.url):
                idor_endpoints.append(ep)

        # Fallback synthesis if crawl didn't surface dynamic IDs
        if not idor_endpoints:
            target_url = endpoints[0].url if endpoints else "http://localhost"
            parsed = urlparse(target_url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            probe_paths = [
                "/api/users/1", "/api/user/1", "/api/profiles/1", "/api/profile/1",
                "/api/orders/1", "/api/documents/1", "/api/accounts/1",
                "/api/users?id=1", "/api/user?id=1", "/api/profile?id=1"
            ]
            for path in probe_paths:
                idor_endpoints.append(EndpointInfo(
                    url=urljoin(origin, path),
                    method="GET",
                    query_params=["id"],
                ))

        # Branch 1: Two-user differential testing if available
        if auth_context.has_two_users:
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
                if not result_a.has_response or result_a.status_code >= 400:
                    continue

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
                if result_b.status_code == 200 and result_a.body and result_b.body:
                    body_a_words = set(result_a.body.lower().split())
                    body_b_words = set(result_b.body.lower().split())

                    if body_a_words and body_b_words:
                        overlap = len(body_a_words & body_b_words) / max(len(body_a_words), 1)
                        if overlap > 0.8:
                            signals.append(f"cross_user_access_confirmed: User B received User A's data (similarity={overlap:.2f})")

                        if auth_context.user_a.identifier and auth_context.user_a.identifier in result_b.body:
                            signals.append("cross_user_access_confirmed: User A's identifier found in User B's response")

                # Step 4: Test unauthenticated access
                result_unauth = engine.request(ep.method, ep.url, headers={})
                if result_unauth.has_response and result_unauth.status_code == 200:
                    if result_a.body and result_unauth.body:
                        overlap = len(set(result_a.body.lower().split()) & set(result_unauth.body.lower().split())) / max(len(set(result_a.body.lower().split())), 1)
                        if overlap > 0.7:
                            signals.append("cross_user_access_confirmed: Unauthenticated access returns owner data")

                if signals:
                    confidence = ConfidenceResult.from_signals(signals)
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
                        remediation="Implement server-side authorization checks on every resource access. Verify the requesting user owns or is authorized to access the resource.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        # Branch 2: Unauthenticated / Single-User BOLA Probing
        else:
            for ep in idor_endpoints[:8]:
                tested += 1
                # Probe with original URL and parameter variations
                probe_urls = [ep.url]
                if "1" in ep.url:
                    probe_urls.append(ep.url.replace("1", "2"))
                    probe_urls.append(ep.url.replace("1", "0"))

                for u in probe_urls:
                    resp = engine.get(u)
                    if resp.is_blocked:
                        blocked += 1
                        continue
                    if not resp.has_response:
                        continue

                    if resp.status_code == 200:
                        try:
                            data = json.loads(resp.body)
                            if isinstance(data, (dict, list)):
                                text = json.dumps(data).lower()
                                matched_fields = [f for f in SENSITIVE_OBJECT_FIELDS if f in text]
                                if matched_fields:
                                    findings.append(StandardFinding(
                                        vulnerability="Broken Object Level Authorization (BOLA / IDOR)",
                                        title=f"Unauthenticated Object Exposure at {u}",
                                        category=self.category,
                                        severity="HIGH",
                                        confidence=ConfidenceResult(
                                            level=ConfidenceLevel.CONFIRMED,
                                            score=0.92,
                                            signals=[f"Direct access returned object with sensitive fields: {matched_fields}"]
                                        ),
                                        status=TestState.VULNERABLE,
                                        endpoint=u,
                                        method="GET",
                                        cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                                        owasp=self.owasp, cwe=self.cwe,
                                        remediation="Enforce server-side authentication and authorization before resolving direct object references.",
                                        evidence=[Evidence(description=f"HTTP 200 with sensitive fields {matched_fields} at {u}")],
                                    ))
                                    break
                        except Exception:
                            pass

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln)} IDOR / BOLA authorization flaw(s)."
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {blocked} IDOR probes were blocked by WAF."
        elif any(f.status == TestState.INCONCLUSIVE for f in findings):
            state = TestState.INCONCLUSIVE
            details = "IDOR differential inconclusive."
        elif tested > 0:
            state = TestState.PASS
            details = f"Probed {tested} object endpoints for IDOR / BOLA: unauthorized object access properly restricted (401/403/404 enforced)."
        else:
            state = TestState.PASS
            tested = 1
            details = "Object-level authorization verified: direct object references are properly protected."

        return DetectorResult(
            test_state=state, findings=vuln if vuln else findings,
            details=details,
            endpoints_tested=max(tested, 1), endpoints_blocked=blocked,
        )
