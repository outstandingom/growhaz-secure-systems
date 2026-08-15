import re
from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence, redact_sensitive, safe_body_snippet
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class SensitiveDataDetector(BaseDetector):
    name = "Sensitive Data Exposure Detector"
    category = "Cryptographic Failures"
    cwe = "CWE-200"
    owasp = "A02:2021-Cryptographic Failures"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        if not endpoints:
            result.test_state = TestState.NOT_APPLICABLE
            return result

        result.test_state = TestState.PASS
        
        patterns = {
            "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "Credit Card": re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b"),
            "Email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
        }

        for endpoint in endpoints:
            req_result = engine.request("GET", endpoint.url)
            result.endpoints_tested += 1

            if req_result.is_error:
                result.test_state = TestState.ERROR
                continue
            if req_result.is_blocked:
                result.test_state = TestState.BLOCKED
                result.endpoints_blocked += 1
                continue

            body = req_result.body
            found_sensitive = False
            for p_name, pattern in patterns.items():
                if p_name == "Email":
                    continue
                matches = pattern.findall(body)
                if matches:
                    found_sensitive = True
                    confidence = ConfidenceResult(ConfidenceLevel.MEDIUM, f"Found pattern matching {p_name}")
                    cvss = CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N")
                    finding = StandardFinding(
                        title=f"Sensitive Data Exposure ({p_name})",
                        description=f"Potential {p_name} found in response body.",
                        severity="Medium",
                        cwe=self.cwe,
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        evidence=Evidence(
                            request=RequestEvidence(method="GET", url=endpoint.url),
                            response=ResponseEvidence(
                                status_code=req_result.status_code, 
                                headers=req_result.headers,
                                body_snippet=safe_body_snippet(redact_sensitive(body))
                            )
                        )
                    )
                    result.findings.append(finding)
            
            if found_sensitive:
                result.test_state = TestState.VULNERABLE

        return result
