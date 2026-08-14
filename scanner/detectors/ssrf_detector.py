"""SSRF Detector — in-band server-side request forgery detection."""
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

SSRF_PARAMS = ['url', 'uri', 'path', 'src', 'dest', 'redirect', 'link', 'feed',
               'host', 'site', 'html', 'data', 'reference', 'callback', 'return',
               'page', 'fetch', 'proxy', 'target', 'domain', 'load', 'file', 'val']

SSRF_PAYLOADS = [
    ("http://127.0.0.1", ["localhost", "127.0.0.1", "root:", "<!doctype"]),
    ("http://127.0.0.1:22", ["ssh", "openssh", "connection refused"]),
    ("http://[::1]", ["localhost", "root:", "<!doctype"]),
    ("http://169.254.169.254/latest/meta-data/", ["ami-id", "instance-id", "instance-type", "iam"]),
    ("http://metadata.google.internal/computeMetadata/v1/", ["attributes", "instance"]),
    ("http://169.254.169.254/metadata/instance", ["compute", "network"]),
]

class SSRFDetector(BaseDetector):
    name = "Server-Side Request Forgery (SSRF)"
    category = "Server-Side Request Forgery"
    cwe = "CWE-918"
    owasp = "A10:2021 - Server-Side Request Forgery (SSRF)"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        testable = [ep for ep in endpoints if any(p in ep.all_params for p in SSRF_PARAMS)]
        if not testable:
            testable = [ep for ep in endpoints if ep.all_params and ep.method in ("GET", "POST")][:5]
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No SSRF-candidate endpoints")

        for ep in testable[:10]:
            tested += 1
            ssrf_params = [p for p in ep.all_params if p.lower() in SSRF_PARAMS] or ep.all_params[:2]
            for param in ssrf_params:
                # Baseline with benign URL
                base_data = {p: ("test" if p != param else "https://www.example.com") for p in ep.all_params}
                baseline = engine.post(ep.url, json=base_data) if ep.method == "POST" else engine.get(ep.url, params=base_data)
                if baseline.is_blocked:
                    blocked += 1; continue

                signals = []
                for payload, indicators in SSRF_PAYLOADS:
                    test_data = {p: ("test" if p != param else payload) for p in ep.all_params}
                    resp = engine.post(ep.url, json=test_data) if ep.method == "POST" else engine.get(ep.url, params=test_data)
                    if resp.is_blocked:
                        blocked += 1; continue
                    if not resp.has_response: continue

                    body_lower = resp.body.lower()
                    matched = [ind for ind in indicators if ind.lower() in body_lower]
                    if matched and (not baseline.has_response or all(ind.lower() not in baseline.body.lower() for ind in matched)):
                        signals.append(f"internal_content_leaked: payload={payload}, indicators={matched}")

                    # Timing: internal requests often much faster/slower than baseline
                    if baseline.has_response and resp.elapsed > 0:
                        time_diff = abs(resp.elapsed - baseline.elapsed)
                        if time_diff > 3.0 and "127.0.0.1" in payload:
                            signals.append(f"timing_anomaly: payload={payload}, diff={time_diff:.1f}s")

                if signals:
                    confidence = ConfidenceResult.from_signals(signals)
                    if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                        findings.append(StandardFinding(
                            vulnerability="Server-Side Request Forgery (SSRF)", category=self.category,
                            severity="HIGH" if "169.254" in str(signals) else "MEDIUM",
                            confidence=confidence, status=TestState.VULNERABLE,
                            endpoint=ep.url, method=ep.method, parameter=param,
                            cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                            owasp=self.owasp, cwe=self.cwe,
                            remediation="Validate and whitelist allowed URLs/domains. Block internal/private IP ranges.",
                            evidence=[Evidence(description=s) for s in signals],
                        ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} SSRF found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
