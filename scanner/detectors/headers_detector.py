from urllib.parse import urlparse
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
        
        # Target URLs to audit
        urls_to_test = [ep.url for ep in endpoints] if endpoints else []
        if not urls_to_test:
            # Fallback to engine baseline host / base_url if available
            urls_to_test = [engine.session.headers.get("Host", "https://target")]

        result.test_state = TestState.PASS
        tested_domains = set()

        for url in urls_to_test:
            domain = urlparse(url).netloc
            if not domain or domain in tested_domains:
                continue
                
            tested_domains.add(domain)
            req_result = engine.request("GET", url)
            result.endpoints_tested += 1

            if req_result.is_error:
                result.test_state = TestState.ERROR
                continue
            if req_result.is_blocked:
                result.test_state = TestState.BLOCKED
                result.endpoints_blocked += 1
                continue

            headers_lower = {k.lower(): v for k, v in req_result.headers.items()}

            # 1. HSTS (Strict-Transport-Security)
            if "strict-transport-security" not in headers_lower and url.startswith("https"):
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, "HTTP Strict-Transport-Security (HSTS) header is missing.")
                cvss = CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="MEDIUM")
                finding = StandardFinding(
                    title="Missing Strict-Transport-Security (HSTS) Header",
                    description="The server does not enforce HTTPS connections via HSTS header, leaving users vulnerable to SSL stripping and man-in-the-middle attacks.",
                    severity="Medium",
                    cwe="CWE-523",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' to all HTTPS responses.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

            # 2. Content Security Policy (CSP)
            if "content-security-policy" not in headers_lower:
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, "Content-Security-Policy (CSP) header is missing.")
                cvss = CVSSInfo(score=4.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N", severity="MEDIUM")
                finding = StandardFinding(
                    title="Missing Content-Security-Policy (CSP)",
                    description="No CSP header detected. Content Security Policy mitigates Cross-Site Scripting (XSS) and data injection attacks by restricting allowed resource sources.",
                    severity="Medium",
                    cwe="CWE-1021",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Implement a strong Content-Security-Policy header restricting script-src, object-src, and frame-ancestors.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

            # 3. Clickjacking Protection (X-Frame-Options)
            if "x-frame-options" not in headers_lower and "frame-ancestors" not in headers_lower.get("content-security-policy", ""):
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, "Neither X-Frame-Options nor CSP frame-ancestors header is configured.")
                cvss = CVSSInfo(score=4.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N", severity="MEDIUM")
                finding = StandardFinding(
                    title="Missing Clickjacking Protection (X-Frame-Options)",
                    description="The web page can be embedded into an <iframe> on third-party sites, enabling Clickjacking attacks.",
                    severity="Medium",
                    cwe="CWE-1021",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Set 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN', or use CSP 'frame-ancestors 'self''.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

            # 4. MIME Sniffing Protection (X-Content-Type-Options)
            if "x-content-type-options" not in headers_lower:
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, "X-Content-Type-Options: nosniff header is missing.")
                cvss = CVSSInfo(score=3.7, vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="LOW")
                finding = StandardFinding(
                    title="Missing X-Content-Type-Options Header",
                    description="Browsers may attempt to MIME-sniff response content types, potentially executing user uploads as HTML/JavaScript.",
                    severity="Low",
                    cwe="CWE-693",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Add 'X-Content-Type-Options: nosniff' header to all server responses.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

            # 5. Referrer Policy & Permissions Policy
            if "referrer-policy" not in headers_lower:
                confidence = ConfidenceResult(ConfidenceLevel.HIGH, "Referrer-Policy header is missing.")
                cvss = CVSSInfo(score=3.1, vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N", severity="LOW")
                finding = StandardFinding(
                    title="Missing Referrer-Policy Header",
                    description="Without a Referrer-Policy header, sensitive URLs and parameters may leak to external third-party domains in HTTP Referer headers.",
                    severity="Low",
                    cwe="CWE-116",
                    owasp=self.owasp,
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Add 'Referrer-Policy: strict-origin-when-cross-origin' to restrict referrer leakage.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

            # 6. Technology & Server Version Disclosure
            disclosure_headers = ["server", "x-powered-by", "x-aspnet-version", "x-generator"]
            disclosed = []
            for h in disclosure_headers:
                if h in headers_lower:
                    disclosed.append(f"{h}: {headers_lower[h]}")

            if disclosed:
                confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Server banner disclosed: {', '.join(disclosed)}")
                cvss = CVSSInfo(score=3.7, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="LOW")
                finding = StandardFinding(
                    title="Information Disclosure via Server Headers",
                    description=f"Server software and version details exposed in response headers: {', '.join(disclosed)}. Attackers can use this information to target known software CVE vulnerabilities.",
                    severity="Low",
                    cwe="CWE-200",
                    owasp="A01:2021-Broken Access Control",
                    cvss=cvss,
                    confidence=confidence,
                    remediation="Configure server to suppress or obfuscate Server and X-Powered-By banners.",
                    evidence=[Evidence(
                        request=RequestEvidence(method="GET", url=url),
                        response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers)
                    )]
                )
                result.findings.append(finding)
                result.test_state = TestState.VULNERABLE

        return result
