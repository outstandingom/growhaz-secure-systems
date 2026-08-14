from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class CSRFDetector(BaseDetector):
    name = "CSRF Detector"
    category = "Broken Access Control"
    cwe = "CWE-352"
    owasp = "A01:2021-Broken Access Control"

    def run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        state_changing_methods = ["POST", "PUT", "DELETE", "PATCH"]
        state_changing_endpoints = [e for e in endpoints if e.method in state_changing_methods]

        if not state_changing_endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "No state-changing endpoints (POST/PUT/DELETE/PATCH) provided."
            return result

        if not auth_context or not auth_context.is_authenticated():
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "CSRF testing requires an authenticated session."
            return result

        result.test_state = TestState.PASS

        for endpoint in state_changing_endpoints:
            headers = {}
            
            req_result = engine.request(endpoint.method, endpoint.url, headers=headers)
            result.endpoints_tested += 1

            if req_result.error:
                result.test_state = TestState.ERROR
                continue
            if req_result.blocked:
                result.test_state = TestState.BLOCKED
                result.endpoints_blocked += 1
                continue

            if req_result.status_code in [200, 201, 204, 302]:
                confidence = ConfidenceResult(ConfidenceLevel.LOW, "State-changing request succeeded without typical CSRF headers. Needs manual verification for token in body.")
                cvss = CVSSInfo(score=6.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N")
                finding = StandardFinding(
                    title="Potential Cross-Site Request Forgery (CSRF)",
                    description="A state-changing endpoint was successfully accessed without anti-CSRF headers.",
                    severity="Medium",
                    cwe=self.cwe,
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    evidence=Evidence(
                        request=RequestEvidence(method=endpoint.method, url=endpoint.url, headers=headers),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

        return result
