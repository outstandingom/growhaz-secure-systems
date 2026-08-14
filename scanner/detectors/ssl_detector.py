from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class SSLDetector(BaseDetector):
    name = "SSL/TLS Detector"
    category = "Cryptographic Failures"
    cwe = "CWE-319"
    owasp = "A02:2021-Cryptographic Failures"

    def run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            return result

        result.test_state = TestState.PASS
        tested_domains = set()

        for endpoint in endpoints:
            if not endpoint.url.startswith("http://"):
                continue
                
            from urllib.parse import urlparse
            domain = urlparse(endpoint.url).netloc
            if domain in tested_domains:
                continue
                
            tested_domains.add(domain)
            
            req_result = engine.request("GET", endpoint.url, allow_redirects=False)
            result.endpoints_tested += 1

            if req_result.error:
                result.test_state = TestState.ERROR
                continue
            if req_result.blocked:
                result.test_state = TestState.BLOCKED
                result.endpoints_blocked += 1
                continue

            if req_result.status_code not in [301, 302, 307, 308]:
                confidence = ConfidenceResult(ConfidenceLevel.HIGH, "Endpoint accepts unencrypted HTTP without redirecting to HTTPS.")
                cvss = CVSSInfo(score=6.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N")
                finding = StandardFinding(
                    title="Unencrypted Communication (HTTP)",
                    description="The application does not enforce HTTPS.",
                    severity="Medium",
                    cwe=self.cwe,
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    evidence=Evidence(
                        request=RequestEvidence(method="GET", url=endpoint.url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

        return result
