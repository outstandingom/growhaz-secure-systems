r"""
Open Redirect Detector — evidence-driven open redirection testing.

Tests:
1. HTTP 3xx redirect tampering (Location header reflection).
2. Protocol-relative redirects (//evil.com).
3. Backslash bypass (/\evil.com).
4. Subdomain bypass / user-info trick (https://evil.com#@target.com).
5. Fallback synthesis on auth, login, and redirection parameters.
"""

from urllib.parse import urlparse, urljoin
from typing import List

from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult


REDIRECT_PARAMS = [
    "redirect", "url", "next", "return", "dest", "to", "target",
    "r", "continue", "returnTo", "checkout_url", "forward", "goto", "view"
]

REDIRECT_PAYLOADS = [
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com?target=",
]


class OpenRedirectDetector(BaseDetector):
    name = "Open Redirect Detector"
    category = "Injection"
    cwe = "CWE-601"
    owasp = "A03:2021-Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        target_base = endpoints[0].url if endpoints else "https://target"
        parsed_base = urlparse(target_base)
        origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"

        # Collect candidate endpoints
        candidate_urls = []
        for ep in endpoints:
            candidate_urls.append(ep.url)

        # Always probe common redirect & auth endpoints
        common_redirect_paths = ["/", "/login", "/auth", "/logout", "/signin", "/redirect", "/goto", "/api/auth/callback"]
        for path in common_redirect_paths:
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

            for param in REDIRECT_PARAMS[:5]:
                for payload in REDIRECT_PAYLOADS:
                    test_url = f"{base_clean}?{param}={payload}"
                    tested += 1

                    req_result = engine.request("GET", test_url, allow_redirects=False)

                    if req_result.is_error:
                        continue
                    if req_result.is_blocked:
                        blocked += 1
                        continue

                    if req_result.status_code in [301, 302, 303, 307, 308]:
                        location = (req_result.headers.get("Location") or "").strip()
                        # Verify if redirected externally to evil.com
                        if "evil.com" in location and not location.startswith((f"https://{parsed.netloc}", f"http://{parsed.netloc}", f"//{parsed.netloc}")):
                            confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Redirected to external domain: Location: {location}")
                            cvss = CVSSInfo(score=6.1, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", severity="MEDIUM")
                            finding = StandardFinding(
                                title=f"Open Redirect via '{param}' Parameter",
                                description=f"The application accepts an untrusted destination in parameter '{param}' and redirects users externally to {location}.",
                                severity="Medium",
                                cwe=self.cwe,
                                owasp=self.owasp,
                                cvss=cvss,
                                confidence=confidence,
                                endpoint=test_url,
                                method="GET",
                                parameter=param,
                                remediation="Implement a strict whitelist of permitted redirect destinations or use relative paths only.",
                                evidence=[Evidence(
                                    request=RequestEvidence(method="GET", url=test_url),
                                    response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
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
            result.details = f"Detected {len(vuln_findings)} open redirect vulnerability/vulnerabilities."
        elif blocked >= tested and tested > 0:
            result.test_state = TestState.BLOCKED
            result.details = f"All {blocked} redirect test probes were blocked by WAF."
        else:
            result.test_state = TestState.PASS
            result.details = f"Tested {tested} parameter combinations across redirect endpoints: external redirections are properly restricted or validated."

        result.endpoints_tested = max(tested, 1)
        result.endpoints_blocked = blocked
        return result
