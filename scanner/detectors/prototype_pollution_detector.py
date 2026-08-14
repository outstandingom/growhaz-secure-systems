"""Prototype Pollution Detector."""
import json
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer

POLLUTION_PAYLOADS = [
    {"__proto__": {"polluted": "growhaz_test_marker"}},
    {"constructor": {"prototype": {"polluted": "growhaz_test_marker"}}},
    {"__proto__": {"isAdmin": True}},
    {"__proto__": {"status": "admin"}},
]

class PrototypePollutionDetector(BaseDetector):
    name = "Prototype Pollution"
    category = "Injection"
    cwe = "CWE-1321"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        testable = [ep for ep in endpoints if ep.accepts_json and ep.method in ("POST", "PUT", "PATCH")]
        if not testable:
            testable = [ep for ep in endpoints if ep.method in ("POST", "PUT", "PATCH")][:5]
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No JSON endpoints found")

        for ep in testable[:10]:
            tested += 1
            signals = []
            # Baseline
            baseline = engine.request(ep.method, ep.url, json={"name": "test"})
            if baseline.is_blocked: blocked += 1; continue

            for payload in POLLUTION_PAYLOADS:
                # Merge payload with normal data
                test_data = {"name": "test"}
                test_data.update(payload)
                resp = engine.request(ep.method, ep.url, json=test_data)
                if resp.is_blocked: blocked += 1; continue
                if not resp.has_response: continue

                if resp.status_code in (200, 201):
                    body_lower = resp.body.lower()
                    # Check if pollution marker appears
                    if "growhaz_test_marker" in body_lower or "polluted" in body_lower:
                        if not baseline.has_response or "polluted" not in baseline.body.lower():
                            signals.append(f"prototype_pollution_reflected: payload={json.dumps(payload)[:60]}")

                    # Check subsequent GET for persistence
                    get_resp = engine.get(ep.url)
                    if get_resp.has_response and ("growhaz_test_marker" in get_resp.body.lower() or "polluted" in get_resp.body.lower()):
                        signals.append(f"prototype_pollution_persisted: marker found in GET response")

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="Prototype Pollution", category=self.category,
                        severity="HIGH", confidence=confidence, status=TestState.VULNERABLE,
                        endpoint=ep.url, method=ep.method,
                        cvss=CVSSInfo(score=7.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L", severity="HIGH"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Validate and sanitize JSON input. Block __proto__ and constructor.prototype keys.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} pollution found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
