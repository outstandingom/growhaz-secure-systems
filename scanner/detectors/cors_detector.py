from typing import List
import urllib.parse
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
        
        origins_to_test = [
            "https://evil.com",
            "null",
            "*",
            "https://subdomain.example.com.evil.com"
        ]

        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "No endpoints provided."
            return result

        result.test_state = TestState.PASS

        for endpoint in endpoints:
            for origin in origins_to_test:
                headers = {"Origin": origin}
                # Also testing preflight
                req_result = engine.request("OPTIONS", endpoint.url, headers=headers)
                
                result.endpoints_tested += 1

                if req_result.error:
                    result.test_state = TestState.ERROR
                    continue
                if req_result.blocked:
                    result.test_state = TestState.BLOCKED
                    result.endpoints_blocked += 1
                    continue

                acao = req_result.headers.get("Access-Control-Allow-Origin", "")
                acac = req_result.headers.get("Access-Control-Allow-Credentials", "false").lower() == "true"

                if acao == origin or (acao == "*" and acac) or (acao == "null"):
                    if acao == origin and acac:
                        severity = "High"
                        confidence = ConfidenceResult(ConfidenceLevel.HIGH, "Reflected origin with credentials allowed")
                        cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N")
                    elif acao == "null" and acac:
                        severity = "High"
                        confidence = ConfidenceResult(ConfidenceLevel.HIGH, "Null origin with credentials allowed")
                        cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N")
                    else:
                        severity = "Informational"
                        confidence = ConfidenceResult(ConfidenceLevel.MEDIUM, "Permissive CORS but no credentials allowed (might be public API)")
                        cvss = CVSSInfo(score=0.0, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N")

                    finding = StandardFinding(
                        title=f"Insecure CORS Misconfiguration ({origin})",
                        description=f"Endpoint allows cross-origin requests from {origin}.",
                        severity=severity,
                        cwe=self.cwe,
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        evidence=Evidence(
                            request=RequestEvidence(method="OPTIONS", url=endpoint.url, headers=headers),
                            response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                        )
                    )
                    result.findings.append(finding)
                    if severity != "Informational":
                        result.test_state = TestState.VULNERABLE

        return result
