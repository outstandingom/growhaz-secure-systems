from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class SecurityHeadersDetector(BaseDetector):
    name = "Security Headers Detector"
    category = "Security Misconfiguration"
    cwe = "CWE-693"
    owasp = "A05:2021-Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            return result

        result.test_state = TestState.PASS
        tested_domains = set()

        required_headers = [
            "X-Frame-Options",
            "X-Content-Type-Options",
            "Content-Security-Policy",
            "Strict-Transport-Security",
            "Referrer-Policy",
            "Permissions-Policy"
        ]

        for endpoint in endpoints:
            from urllib.parse import urlparse
            domain = urlparse(endpoint.url).netloc
            if domain in tested_domains:
                continue
                
            tested_domains.add(domain)
            req_result = engine.request("GET", endpoint.url)
            result.endpoints_tested += 1

            if req_result.error:
                result.test_state = TestState.ERROR
                continue
            if req_result.blocked:
                result.test_state = TestState.BLOCKED
                result.endpoints_blocked += 1
                continue

            missing_headers = []
            for header in required_headers:
                header_found = any(h.lower() == header.lower() for h in req_result.headers.keys())
                if not header_found:
                    missing_headers.append(header)
            
            disclosure_headers = ["Server", "X-Powered-By", "X-AspNet-Version"]
            disclosed = []
            for h in disclosure_headers:
                for res_h, res_v in req_result.headers.items():
                    if res_h.lower() == h.lower():
                        disclosed.append(f"{res_h}: {res_v}")

            if missing_headers:
                confidence = ConfidenceResult(ConfidenceLevel.HIGH, f"Missing headers: {', '.join(missing_headers)}")
                cvss = CVSSInfo(score=0.0, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N")
                finding = StandardFinding(
                    title="Missing Security Headers",
                    description=f"The application is missing security headers: {', '.join(missing_headers)}",
                    severity="Informational",
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

            if disclosed:
                confidence = ConfidenceResult(ConfidenceLevel.HIGH, f"Disclosed headers: {', '.join(disclosed)}")
                cvss = CVSSInfo(score=0.0, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N")
                finding = StandardFinding(
                    title="Information Disclosure (Headers)",
                    description=f"Server technology disclosed in headers: {', '.join(disclosed)}",
                    severity="Informational",
                    cwe="CWE-200",
                    owasp="A01:2021-Broken Access Control",
                    cvss=cvss,
                    confidence=confidence,
                    evidence=Evidence(
                        request=RequestEvidence(method="GET", url=endpoint.url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )
                )
                result.findings.append(finding)
                if result.test_state == TestState.PASS:
                    result.test_state = TestState.VULNERABLE

        return result
