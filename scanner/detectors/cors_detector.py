from urllib.parse import urlparse
from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class CORSDetector(BaseDetector):
    name = "CORS Misconfiguration Detector"
    category = "Security Misconfiguration"
    cwe = "CWE-942"
    owasp = "A05:2021-Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        urls_to_test = [ep.url for ep in endpoints] if endpoints else []
        if not urls_to_test:
            urls_to_test = [engine.session.headers.get("Host", "https://target")]

        origins_to_test = [
            "https://evil.com",
            "null",
            "https://subdomain.target.com.evil.com"
        ]

        result.test_state = TestState.PASS
        tested_urls = set()

        for url in urls_to_test:
            if url in tested_urls:
                continue
            tested_urls.add(url)

            for origin in origins_to_test:
                headers = {"Origin": origin}
                # Test GET & OPTIONS
                for method in ["GET", "OPTIONS"]:
                    req_result = engine.request(method, url, headers=headers)
                    result.endpoints_tested += 1

                    if req_result.is_error:
                        continue
                    if req_result.is_blocked:
                        result.endpoints_blocked += 1
                        continue

                    headers_lower = {k.lower(): v for k, v in req_result.headers.items()}
                    acao = headers_lower.get("access-control-allow-origin", "")
                    acac = headers_lower.get("access-control-allow-credentials", "false").lower() == "true"

                    if acao == origin or (acao == "*" and acac) or (acao == "null"):
                        if (acao == origin or acao == "null") and acac:
                            severity = "High"
                            confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Arbitrary origin '{origin}' reflected with Access-Control-Allow-Credentials: true")
                            cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH")
                            desc = f"The endpoint {url} reflects arbitrary Origin '{origin}' alongside Access-Control-Allow-Credentials: true. Cross-origin attackers can read authenticated user data."
                        else:
                            severity = "Low"
                            confidence = ConfidenceResult(ConfidenceLevel.MEDIUM, f"Permissive CORS Access-Control-Allow-Origin: {acao}")
                            cvss = CVSSInfo(score=3.7, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="LOW")
                            desc = f"The endpoint {url} allows cross-origin requests from {origin}."

                        finding = StandardFinding(
                            title=f"CORS Misconfiguration ({origin})",
                            description=desc,
                            severity=severity,
                            cwe=self.cwe,
                            owasp=self.owasp,
                            cvss=cvss,
                            confidence=confidence,
                            remediation="Implement an explicit whitelist of trusted origins in Access-Control-Allow-Origin. Never reflect untrusted Origin headers with credentials.",
                            evidence=[Evidence(
                                request=RequestEvidence(method=method, url=url, headers=headers),
                                response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                            )]
                        )
                        result.findings.append(finding)
                        if severity != "Low":
                            result.test_state = TestState.VULNERABLE

        return result
