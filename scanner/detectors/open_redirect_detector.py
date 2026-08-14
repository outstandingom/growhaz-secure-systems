from urllib.parse import urlparse
from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class OpenRedirectDetector(BaseDetector):
    name = "Open Redirect Detector"
    category = "Injection"
    cwe = "CWE-601"
    owasp = "A03:2021-Injection"

    def run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            return result

        result.test_state = TestState.PASS
        payloads = ["https://evil.com", "//evil.com"]

        for endpoint in endpoints:
            parsed = urlparse(endpoint.url)
            if not parsed.query:
                continue

            for payload in payloads:
                # Basic injection at the end of query parameters for demonstration
                test_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?redirect={payload}"
                
                req_result = engine.send_request("GET", test_url, allow_redirects=False)
                result.endpoints_tested += 1

                if req_result.error:
                    result.test_state = TestState.ERROR
                    continue
                if req_result.blocked:
                    result.test_state = TestState.BLOCKED
                    result.endpoints_blocked += 1
                    continue

                if req_result.status_code in [301, 302, 303, 307, 308]:
                    location = req_result.headers.get("Location", "")
                    if location == payload or location.startswith(payload):
                        confidence = ConfidenceResult(ConfidenceLevel.HIGH, f"Redirected to payload {payload}")
                        cvss = CVSSInfo(score=6.1, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N")
                        finding = StandardFinding(
                            title="Open Redirect",
                            description="The application redirects to an untrusted domain.",
                            severity="Medium",
                            cwe=self.cwe,
                            owasp=self.owasp,
                            cvss=cvss,
                            confidence=confidence,
                            evidence=Evidence(
                                request=RequestEvidence(method="GET", url=test_url),
                                response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                            )
                        )
                        result.findings.append(finding)
                        result.test_state = TestState.VULNERABLE
                        break

        return result
