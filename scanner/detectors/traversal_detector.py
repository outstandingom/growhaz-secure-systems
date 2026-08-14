from urllib.parse import urlparse
from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence, safe_body_snippet
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class DirectoryTraversalDetector(BaseDetector):
    name = "Directory Traversal Detector"
    category = "Broken Access Control"
    cwe = "CWE-22"
    owasp = "A01:2021-Broken Access Control"

    def run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            return result

        result.test_state = TestState.PASS
        payloads = [
            "../../../../../../../../etc/passwd",
            "..%2f..%2f..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd",
            "C:\\Windows\\win.ini",
            "..\\..\\..\\..\\..\\..\\..\\..\\Windows\\win.ini"
        ]

        for endpoint in endpoints:
            parsed = urlparse(endpoint.url)
            if not parsed.query:
                continue

            for payload in payloads:
                test_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?file={payload}"
                
                req_result = engine.send_request("GET", test_url)
                result.endpoints_tested += 1

                if req_result.error:
                    result.test_state = TestState.ERROR
                    continue
                if req_result.blocked:
                    result.test_state = TestState.BLOCKED
                    result.endpoints_blocked += 1
                    continue

                body = req_result.text
                if "root:x:0:0" in body or "[extensions]" in body:
                    confidence = ConfidenceResult(ConfidenceLevel.HIGH, "Found typical OS file content in response")
                    cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N")
                    finding = StandardFinding(
                        title="Directory Traversal",
                        description="The application is vulnerable to directory traversal.",
                        severity="High",
                        cwe=self.cwe,
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        evidence=Evidence(
                            request=RequestEvidence(method="GET", url=test_url),
                            response=ResponseEvidence(
                                status_code=req_result.status_code, 
                                headers=req_result.headers,
                                body_snippet=safe_body_snippet(body)
                            )
                        )
                    )
                    result.findings.append(finding)
                    result.test_state = TestState.VULNERABLE
                    break

        return result
