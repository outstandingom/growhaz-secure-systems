import re
from urllib.parse import urljoin, urlparse
from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence, redact_sensitive, safe_body_snippet
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

class SensitiveDataDetector(BaseDetector):
    name = "Sensitive Data Exposure Detector"
    category = "Cryptographic Failures & Exposure"
    cwe = "CWE-200"
    owasp = "A02:2021-Cryptographic Failures"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        urls_to_test = [ep.url for ep in endpoints] if endpoints else []
        if not urls_to_test:
            urls_to_test = [engine.session.headers.get("Host", "https://target")]

        base_url = urls_to_test[0]
        parsed_base = urlparse(base_url)
        origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"

        result.test_state = TestState.PASS

        # 1. Probe for critical exposed sensitive files
        sensitive_paths = {
            "/.env": ("Environment Configuration File", "High", 7.5, "CWE-552", "Contains secret environment variables, API keys, or database credentials."),
            "/.git/HEAD": ("Exposed Git Source Code Repository", "High", 7.5, "CWE-538", "Git version control directory is publicly accessible, allowing source code download."),
            "/config.json": ("Exposed Application Configuration", "Medium", 5.3, "CWE-200", "Application configuration file accessible without authentication."),
            "/backup.sql": ("Exposed Database Backup File", "Critical", 9.8, "CWE-530", "Database dump file exposed publicly."),
            "/phpinfo.php": ("Exposed PHP Environment Info", "Medium", 5.3, "CWE-200", "phpinfo() output exposes full server configuration, module versions, and internal paths.")
        }

        for path, (title, sev_str, score, cwe_id, desc) in sensitive_paths.items():
            test_target = urljoin(origin_url, path)
            req_res = engine.request("GET", test_target)
            result.endpoints_tested += 1

            if req_res.is_error or req_res.is_blocked:
                continue

            if req_res.status_code == 200 and req_res.body:
                body_lower = req_res.body.lower()
                is_valid_exposure = False
                if path == "/.env" and ("db_password" in body_lower or "app_key" in body_lower or "secret" in body_lower or "api_key" in body_lower or "=" in req_res.body):
                    is_valid_exposure = True
                elif path == "/.git/HEAD" and ("ref: refs/" in req_res.body or "master" in req_res.body or "main" in req_res.body):
                    is_valid_exposure = True
                elif path == "/phpinfo.php" and ("php version" in body_lower or "system" in body_lower):
                    is_valid_exposure = True
                elif path == "/backup.sql" and ("insert into" in body_lower or "create table" in body_lower):
                    is_valid_exposure = True

                if is_valid_exposure:
                    confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Successfully accessed sensitive path {path}")
                    cvss = CVSSInfo(score=score, vector=f"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity=sev_str.upper())
                    finding = StandardFinding(
                        title=title,
                        description=f"{desc} (Endpoint: {test_target})",
                        severity=sev_str,
                        cwe=cwe_id,
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        remediation=f"Restrict public web server access to {path} or remove it from web root.",
                        evidence=[Evidence(
                            request=RequestEvidence(method="GET", url=test_target),
                            response=ResponseEvidence(status_code=200, headers=req_res.headers, body_snippet=safe_body_snippet(redact_sensitive(req_res.body)))
                        )]
                    )
                    result.findings.append(finding)
                    result.test_state = TestState.VULNERABLE

        # 2. Secret Key Pattern Scanning in Response Bodies
        secret_patterns = {
            "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
            "Generic API Private Key": re.compile(r"\bsk_live_[0-9a-zA-Z]{24}\b"),
            "GitHub Access Token": re.compile(r"\bghp_[0-9a-zA-Z]{36}\b"),
            "RSA/Private SSH Key": re.compile(r"-----BEGIN [A-Z]+ PRIVATE KEY-----"),
            "Database Connection URL": re.compile(r"\b(?:postgres|mongodb|mysql):\/\/[^\s\"']+\b")
        }

        for url in urls_to_test[:10]:
            req_result = engine.request("GET", url)
            result.endpoints_tested += 1

            if req_result.is_error or req_result.is_blocked or not req_result.body:
                continue

            body = req_result.body
            for p_name, pattern in secret_patterns.items():
                if pattern.search(body):
                    confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Matched pattern for {p_name}")
                    cvss = CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH")
                    finding = StandardFinding(
                        title=f"Exposed {p_name} in Web Response",
                        description=f"Potential {p_name} leaked in HTTP response body on {url}.",
                        severity="High",
                        cwe="CWE-798",
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        remediation="Remove hardcoded secrets from client-side responses. Rotate exposed credentials immediately.",
                        evidence=[Evidence(
                            request=RequestEvidence(method="GET", url=url),
                            response=ResponseEvidence(status_code=req_result.status_code, headers=req_result.headers, body_snippet=safe_body_snippet(redact_sensitive(body)))
                        )]
                    )
                    result.findings.append(finding)
                    result.test_state = TestState.VULNERABLE

        return result
