"""
Business Logic Flaw Detector — probes common e-commerce/wallet flaws.

Only flags when server returns a 2xx success indicator with an obviously
invalid payload (negative price, zero amount, privilege escalation flag).
"""
from typing import List
from urllib.parse import urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, ResponseEvidence, safe_body_snippet
from ..models.confidence import ConfidenceResult, ConfidenceLevel


LOGIC_TESTS = [
    ("Negative Quantity", ["/api/cart/add", "/api/order", "/api/checkout", "/api/cart/update"],
     {"product_id": 1, "quantity": -5, "price": 100}),
    ("Price Manipulation", ["/api/cart/add", "/api/order", "/api/checkout"],
     {"product_id": 1, "quantity": 1, "price": 0.01, "amount": 0.01}),
    ("Quantity Overflow", ["/api/cart/add", "/api/order"],
     {"product_id": 1, "quantity": 999999999}),
    ("Privilege Escalation", ["/api/user/role", "/api/user/update", "/api/profile", "/api/admin/access"],
     {"role": "admin", "is_admin": True, "admin": True}),
    ("Payment Bypass", ["/api/order/complete", "/api/checkout/finalize", "/api/payment/skip"],
     {"order_id": 1, "paid": True, "skip_payment": True, "status": "paid"}),
    ("Coupon Reuse", ["/api/cart/apply-coupon", "/api/coupon/apply"],
     {"coupon": "TEST50", "apply_multiple": True}),
]

SUCCESS_INDICATORS = ("success", "confirmed", "updated", "processed", "completed", "applied", "created", "\"ok\":true", "\"status\":\"ok\"", "\"paid\":true")


class BusinessLogicDetector(BaseDetector):
    name = "Business Logic Flaws"
    category = "Insecure Design"
    cwe = "CWE-840"
    owasp = "A04:2021 - Insecure Design"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        base = ""
        if endpoints:
            base = endpoints[0].url
            # derive origin
            from urllib.parse import urlparse
            u = urlparse(base)
            base = f"{u.scheme}://{u.netloc}"

        discovered = {ep.url.lower(): ep for ep in endpoints}
        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for name, paths, payload in LOGIC_TESTS:
            for path in paths:
                url = urljoin(base + "/", path.lstrip("/")) if base else path
                # only test if endpoint appears reachable
                if not any(path.lower() in u for u in discovered) and base:
                    # still probe common paths but softly (single request)
                    probe = engine.get(url)
                    if probe.is_error or (probe.status_code in (0, 404)):
                        continue
                tested += 1
                r = engine.post(url, json=payload)
                if r.is_blocked:
                    blocked += 1
                    continue
                if not r.has_response:
                    continue

                body_low = (r.body or "").lower()
                if r.status_code in (200, 201) and any(s in body_low for s in SUCCESS_INDICATORS):
                    findings.append(StandardFinding(
                        vulnerability=f"Business Logic Flaw: {name}",
                        title=f"Business Logic Flaw: {name}",
                        category=self.category,
                        severity="HIGH",
                        confidence=ConfidenceResult(ConfidenceLevel.MEDIUM, f"server returned 2xx success for invalid payload ({name})"),
                        status=TestState.VULNERABLE,
                        endpoint=url,
                        method="POST",
                        parameter=name,
                        payload=str(payload)[:200],
                        cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N", severity="HIGH"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Validate all business-critical inputs server-side. Never trust prices, quantities, roles, or paid flags from the client. Enforce ranges and privilege checks in application logic.",
                        description=f"Endpoint accepted {name.lower()} payload without validation. This can lead to financial loss or privilege escalation.",
                        evidence=[Evidence(
                            description=f"{name}: {payload} accepted with HTTP {r.status_code}",
                            response=ResponseEvidence(status_code=r.status_code, body_snippet=safe_body_snippet(r.body or "")),
                        )],
                    ))
                    break

        state = (TestState.VULNERABLE if findings
                 else TestState.BLOCKED if blocked >= tested and tested > 0
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(
            test_state=state, findings=findings,
            details=f"Probed {tested} business-logic candidates. {len(findings)} issues.",
            endpoints_tested=tested, endpoints_blocked=blocked,
        )
