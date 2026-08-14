"""Mass Assignment Detector."""
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer

PRIVILEGE_FIELDS = [
    ("role", "admin"), ("isAdmin", True), ("is_admin", True),
    ("is_superuser", True), ("admin", True), ("permissions", ["admin"]),
    ("user_type", "admin"), ("access_level", "admin"), ("verified", True),
    ("is_staff", True), ("privilege", "admin"),
]

class MassAssignmentDetector(BaseDetector):
    name = "Mass Assignment"
    category = "Broken Access Control"
    cwe = "CWE-915"
    owasp = "A01:2021 - Broken Access Control"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        # Test state-changing endpoints with body params
        testable = [ep for ep in endpoints if ep.is_state_changing and ep.method in ("POST", "PUT", "PATCH")]
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No state-changing endpoints found")

        for ep in testable[:10]:
            tested += 1
            # Get baseline response with normal data
            normal_data = {p: "testvalue" for p in ep.all_params[:5]} if ep.all_params else {"name": "TestUser"}
            baseline = engine.request(ep.method, ep.url, json=normal_data)
            if baseline.is_blocked: blocked += 1; continue
            if not baseline.has_response: continue

            signals = []
            for field_name, field_value in PRIVILEGE_FIELDS:
                # Inject privilege field
                injected = dict(normal_data)
                injected[field_name] = field_value
                resp = engine.request(ep.method, ep.url, json=injected)
                if resp.is_blocked: blocked += 1; continue
                if not resp.has_response: continue

                # Check if the injected field appears in the response
                if resp.status_code in (200, 201):
                    body_lower = resp.body.lower()
                    field_lower = field_name.lower()
                    if field_lower in body_lower:
                        # Verify it wasn't already in baseline
                        if not baseline.has_response or field_lower not in baseline.body.lower():
                            signals.append(f"privilege_field_accepted: {field_name}={field_value}")

                    # Check subsequent GET to verify persistence
                    if ep.method in ("PUT", "PATCH"):
                        get_resp = engine.get(ep.url)
                        if get_resp.has_response and field_lower in get_resp.body.lower():
                            signals.append(f"privilege_field_persisted: {field_name} found in subsequent GET")

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="Mass Assignment", category=self.category, severity="HIGH",
                        confidence=confidence, status=TestState.VULNERABLE,
                        endpoint=ep.url, method=ep.method,
                        cvss=CVSSInfo(score=6.5, vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N", severity="MEDIUM"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Use allowlists for accepted fields. Never bind user input directly to model objects.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} mass assignment found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
