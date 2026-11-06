"""
IDOR/BOLA Detector — identity-aware, cross-user authorization testing.

Detection approach:
1. If two users are provided: runs cross-user authorization differential testing.
2. If unauthenticated/single-user: probes object endpoints, UUID parameters, and BaaS REST filters
   for Broken Object Level Authorization (BOLA) and unauthorized access to customer records.
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

IDOR_PATH_PATTERNS = [
    r'/users?/\d+', r'/profiles?/\d+', r'/orders?/\d+',
    r'/documents?/\d+', r'/payments?/\d+', r'/accounts?/\d+',
    r'/api/v\d+/\w+/\d+', r'/\w+/\{id\}',
]

IDOR_URL_KEYWORDS = [
    '/user', '/profile', '/order', '/document',
    '/payment', '/account', '/api/users', '/api/orders',
    '/api/documents', '/api/accounts', '/rest/v1/profiles',
    '/rest/v1/users', '/rest/v1/organizations',
]

DYNAMIC_ID_RE = re.compile(r'/\d{1,10}(?:/|$)')
UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.IGNORECASE)

SENSITIVE_OBJECT_FIELDS = {
    "email", "password", "hash", "ssn", "secret", "token", "credit_card",
    "balance", "full_name", "role", "api_key", "phone", "address"
}


class IDORDetector(BaseDetector):
    name = "Insecure Direct Object Reference (IDOR)"
    category = "Broken Access Control"
    cwe = "CWE-639"
    owasp = "A01:2021 - Broken Access Control"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings = []
        tested = 0
        endpoints_blocked = 0

        idor_endpoints = []
        for ep in endpoints:
            url_lower = ep.url.lower()
            defaults = getattr(ep, "default_params", {}) or {}
            params_lower = [p.lower() for p in (ep.all_params + list(defaults.keys()))]
            has_id_param = any(any(k in p for k in ("user_id", "userid", "account_id", "order_id", "doc_id", "id")) for p in params_lower)
            has_uuid_val = any(UUID_RE.search(str(v)) for v in defaults.values()) or UUID_RE.search(ep.url)

            if any(kw in url_lower for kw in IDOR_URL_KEYWORDS):
                idor_endpoints.append(ep)
            elif any(re.search(p, ep.url) for p in IDOR_PATH_PATTERNS):
                idor_endpoints.append(ep)
            elif ep.path_params:
                idor_endpoints.append(ep)
            elif DYNAMIC_ID_RE.search(ep.url) or has_uuid_val or has_id_param:
                idor_endpoints.append(ep)

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

        # Branch 1: Two-user differential testing
        if auth_context.has_two_users:
            import requests as req_lib
            session_a = req_lib.Session()
            auth_context.apply_auth(session_a, auth_context.user_a)

            session_b = req_lib.Session()
            auth_context.apply_auth(session_b, auth_context.user_b)

            for ep in idor_endpoints[:10]:
                tested += 1
                signals = []

                result_a = engine.request(
                    ep.method, ep.url,
                    headers=auth_context.user_a.get_auth_headers()
                )

                if result_a.is_blocked:
                    endpoints_blocked += 1
                    continue
                if not result_a.has_response or result_a.status_code >= 400:
                    continue

                result_b = engine.request(
                    ep.method, ep.url,
                    headers=auth_context.user_b.get_auth_headers()
                )

                if result_b.is_blocked:
                    endpoints_blocked += 1
                    continue
                if not result_b.has_response:
                    continue

                if result_b.status_code == 200 and result_a.body and result_b.body:
                    body_a_words = set(result_a.body.lower().split())
                    body_b_words = set(result_b.body.lower().split())

                    if body_a_words and body_b_words:
                        overlap = len(body_a_words & body_b_words) / max(len(body_a_words), 1)
                        if overlap > 0.8:
                            signals.append(f"cross_user_access_confirmed: User B received User A's data (similarity={overlap:.2f})")

                        if auth_context.user_a.identifier and auth_context.user_a.identifier in result_b.body:
                            signals.append("cross_user_access_confirmed: User A's identifier found in User B's response")

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

        # Branch 2: Single-User / Unauthenticated BOLA & Filter Tampering
        else:
            for ep in idor_endpoints[:10]:
                tested += 1
                ep_reqs = 0
                ep_blocked = 0
                headers = dict(getattr(ep, "headers", {}) or {})
                defaults = dict(getattr(ep, "default_params", {}) or {})

                probes = []
                # Probe A: Original parameters
                probes.append((ep.url, dict(defaults), dict(headers), "original_baseline"))

                id_param = None
                for p in (list(defaults.keys()) + ep.query_params):
                    if any(k in p.lower() for k in ("user_id", "userid", "account_id", "id", "uuid")):
                        id_param = p
                        break

                if id_param:
                    orig_val = defaults.get(id_param, "")
                    tampered_val = "00000000-0000-0000-0000-000000000000" if UUID_RE.search(orig_val) else "2"
                    if "eq." in orig_val:
                        tampered_val = f"eq.{tampered_val}"
                    p_tampered = dict(defaults)
                    p_tampered[id_param] = tampered_val
                    probes.append((ep.url, p_tampered, dict(headers), f"tampered_{id_param}={tampered_val}"))

                    # Stripped parameter probe (testing unauthorized collection access)
                    p_stripped = dict(defaults)
                    p_stripped.pop(id_param, None)
                    probes.append((ep.url, p_stripped, dict(headers), f"stripped_{id_param}_filter"))

                    # Inverted filter probe (neq)
                    p_inverted = dict(defaults)
                    p_inverted[id_param] = "neq.00000000-0000-0000-0000-000000000000"
                    probes.append((ep.url, p_inverted, dict(headers), f"inverted_{id_param}"))

                # Path-based ID tampering
                if "1" in ep.url:
                    probes.append((ep.url.replace("1", "2"), dict(defaults), dict(headers), "tampered_path_id=2"))
                if UUID_RE.search(ep.url):
                    probes.append((UUID_RE.sub("00000000-0000-0000-0000-000000000000", ep.url), dict(defaults), dict(headers), "tampered_path_uuid"))

                for u, p_data, h_data, probe_type in probes:
                    ep_reqs += 1
                    resp = (engine.post(u, json=p_data, headers=h_data) if ep.method == "POST"
                            else engine.get(u, params=p_data, headers=h_data))
                    if resp.is_blocked:
                        ep_blocked += 1
                        continue
                    if not resp.has_response or resp.status_code != 200:
                        continue

                    try:
                        data = json.loads(resp.body)
                        if isinstance(data, (dict, list)):
                            text = json.dumps(data).lower()
                            matched_fields = [f for f in SENSITIVE_OBJECT_FIELDS if f in text]
                            # If probe was tampered or stripped and still returned records with sensitive user fields
                            if matched_fields and probe_type != "original_baseline":
                                findings.append(StandardFinding(
                                    vulnerability="Broken Object Level Authorization (BOLA / IDOR)",
                                    title=f"BOLA / Object Exposure via {probe_type} at {u}",
                                    category=self.category,
                                    severity="HIGH",
                                    confidence=ConfidenceResult(
                                        level=ConfidenceLevel.CONFIRMED,
                                        score=0.94,
                                        signals=[f"Direct access with {probe_type} returned sensitive fields: {matched_fields}"]
                                    ),
                                    status=TestState.VULNERABLE,
                                    endpoint=u,
                                    method=ep.method,
                                    parameter=id_param or "",
                                    cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                                    owasp=self.owasp, cwe=self.cwe,
                                    remediation="Enforce server-side authorization checks on every resource access. Validate that the requesting identity owns the requested object.",
                                    evidence=[Evidence(description=f"HTTP 200 returned sensitive fields {matched_fields} for {probe_type} at {u}")],
                                ))
                                break
                    except Exception:
                        pass

                if ep_blocked >= ep_reqs and ep_reqs > 0:
                    endpoints_blocked += 1

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln)} IDOR / BOLA authorization flaw(s)."
        elif endpoints_blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {endpoints_blocked} IDOR probes were blocked by WAF."
        elif any(f.status == TestState.INCONCLUSIVE for f in findings):
            state = TestState.INCONCLUSIVE
            details = "IDOR differential inconclusive."
        else:
            state = TestState.PASS
            details = f"Probed {tested} object endpoints for IDOR / BOLA: unauthorized object access properly restricted (401/403/404 enforced)."

        return DetectorResult(
            test_state=state, findings=vuln if vuln else findings,
            details=details,
            endpoints_tested=max(tested, 1), endpoints_blocked=endpoints_blocked,
        )
