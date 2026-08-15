from urllib.parse import urlparse
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

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        urls_to_test = [ep.url for ep in endpoints] if endpoints else []
        if not urls_to_test:
            urls_to_test = [engine.session.headers.get("Host", "https://target")]

        result.test_state = TestState.PASS
        tested_domains = set()

        for url in urls_to_test:
            parsed = urlparse(url)
            domain = parsed.netloc
            if not domain or domain in tested_domains:
                continue
                
            tested_domains.add(domain)
            
            # 1. Test HTTP to HTTPS redirection
            http_url = f"http://{domain}/"
            req_result = engine.request("GET", http_url, allow_redirects=False)
            result.endpoints_tested += 1

            if req_result.is_error:
                continue
            if req_result.is_blocked:
                result.endpoints_blocked += 1
                continue

            # If http:// accepts requests without 301/302/307/308 redirect to https://
            if req_result.status_code and req_result.status_code not in [301, 302, 307, 308]:
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Plain HTTP endpoint returned status {req_result.status_code} without redirecting to HTTPS.")
                cvss = CVSSInfo(score=6.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N", severity="MEDIUM")
                finding = StandardFinding(
                    title="Unencrypted HTTP Protocol Exposed",
                    description=f"The application allows unencrypted HTTP connections on {http_url} without enforcing HTTPS redirection. Attackers on the same network (e.g. public Wi-Fi) can intercept credentials and session cookies.",
                    severity="Medium",
                    cwe="CWE-319",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Configure web server to issue a 301 Permanent Redirect from http:// to https:// for all incoming traffic.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=http_url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

        return result
