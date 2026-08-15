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

    # Cap how many endpoints we probe — CORS is a per-origin/server policy,
    # testing every crawled page only produces duplicate findings.
    MAX_URLS = 12

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()

        urls_to_test = []
        for ep in endpoints or []:
            if ep.url not in urls_to_test:
                urls_to_test.append(ep.url)
            if len(urls_to_test) >= self.MAX_URLS:
                break

        if not urls_to_test:
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "No endpoints available to test CORS policy"
            return result

        origins_to_test = [
            "https://evil.com",
            "null",
        ]

        result.test_state = TestState.PASS
        reflected_no_creds = []   # (url, origin, acao, method, status, headers)
        credentialed = []         # confirmed vulnerable

        for url in urls_to_test:
            for origin in origins_to_test:
                headers = {"Origin": origin}
                for method in ["GET", "OPTIONS"]:
                    req_result = engine.request(method, url, headers=headers)
                    result.endpoints_tested += 1

                    if req_result.is_error:
                        continue
                    if req_result.is_blocked:
                        result.endpoints_blocked += 1
                        continue

                    headers_lower = {k.lower(): v for k, v in req_result.headers.items()}
                    acao = (headers_lower.get("access-control-allow-origin") or "").strip()
                    acac = (headers_lower.get("access-control-allow-credentials") or "").strip().lower() == "true"

                    if not acao:
                        continue

                    # Only a reflection of OUR injected origin proves the policy
                    # is origin-reflecting. A static "*" without credentials is
                    # the normal configuration for public assets — not a finding.
                    reflects_attacker_origin = acao == origin

                    entry = (url, origin, acao, method, req_result.status_code, req_result.headers)

                    if reflects_attacker_origin and acac:
                        credentialed.append(entry)
                    elif acao == "*" and acac:
                        # Browsers reject this combination, but it signals a
                        # misconfigured framework — report as low severity.
                        reflected_no_creds.append(entry)
                    elif reflects_attacker_origin:
                        reflected_no_creds.append(entry)

        for url, origin, acao, method, status, resp_headers in credentialed[:3]:
            result.findings.append(StandardFinding(
                title="CORS Misconfiguration with Credentials",
                description=(
                    f"The server reflects an arbitrary Origin header "
                    f"('{origin}') in Access-Control-Allow-Origin together with "
                    f"Access-Control-Allow-Credentials: true. Any website can read "
                    f"authenticated responses from {url} on behalf of a logged-in victim."
                ),
                severity="High",
                category=self.category,
                endpoint=url,
                method=method,
                cwe=self.cwe,
                owasp=self.owasp,
                status=TestState.VULNERABLE,
                cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH", is_estimated=False),
                confidence=ConfidenceResult(
                    ConfidenceLevel.CONFIRMED,
                    f"Origin '{origin}' reflected with Access-Control-Allow-Credentials: true",
                ),
                remediation=(
                    "Validate the Origin header against an explicit allow-list before "
                    "echoing it back. Never combine a reflected/wildcard origin with "
                    "Access-Control-Allow-Credentials: true."
                ),
                evidence=[Evidence(
                    request=RequestEvidence(method=method, url=url, headers={"Origin": origin}),
                    response=ResponseEvidence(status_code=status, headers=resp_headers),
                )],
            ))
            result.test_state = TestState.VULNERABLE

        if not credentialed and reflected_no_creds:
            url, origin, acao, method, status, resp_headers = reflected_no_creds[0]
            urls = sorted({e[0] for e in reflected_no_creds})
            result.findings.append(StandardFinding(
                title="Permissive CORS Policy",
                description=(
                    f"The server echoes untrusted Origin values (tested with '{origin}') "
                    f"in Access-Control-Allow-Origin. Credentials are not allowed, so the "
                    f"impact is limited to data already reachable without authentication, "
                    f"but the policy should still be restricted to trusted origins.\n\n"
                    f"Observed on {len(urls)} endpoint(s)."
                ),
                severity="Low",
                category=self.category,
                endpoint=url,
                method=method,
                cwe=self.cwe,
                owasp=self.owasp,
                status=TestState.VULNERABLE,
                cvss=CVSSInfo(score=3.7, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="LOW"),
                confidence=ConfidenceResult(
                    ConfidenceLevel.MEDIUM,
                    f"Access-Control-Allow-Origin reflected as '{acao}' without credentials",
                ),
                remediation=(
                    "Replace origin reflection with an explicit allow-list of trusted origins."
                ),
                evidence=[Evidence(
                    request=RequestEvidence(method=method, url=url, headers={"Origin": origin}),
                    response=ResponseEvidence(status_code=status, headers=resp_headers),
                )],
            ))

        if not result.findings:
            result.details = f"No permissive CORS policy detected across {len(urls_to_test)} endpoint(s)"
        else:
            result.details = f"{len(result.findings)} CORS issue(s) detected"

        return result
