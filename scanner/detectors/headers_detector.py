"""
Security Headers Detector — evidence-driven.

Design goals (v2):
  * Only test HTML document responses (JSON/API/static assets do not need CSP,
    X-Frame-Options, etc.) — this was the main source of false positives.
  * Test one representative document per host instead of every crawled URL.
  * Understand mitigations: CSP `frame-ancestors` replaces X-Frame-Options,
    a meta CSP tag counts as a CSP, HSTS only applies over HTTPS.
  * Never report a "missing header" without printing the exact set of security
    headers that WERE observed, so the report shows *why* it is a finding.
"""

import re
from urllib.parse import urlparse

from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult

SECURITY_HEADER_NAMES = [
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
]

DISCLOSURE_HEADERS = ["server", "x-powered-by", "x-aspnet-version", "x-generator"]

# Banners that reveal an exact version (e.g. "nginx/1.18.0", "PHP/8.1.2")
VERSION_RE = re.compile(r"\d+\.\d+")

# Generic CDN banners that leak nothing useful
BENIGN_BANNERS = {"cloudflare", "vercel", "netlify", "aws", "akamai", "gws", "esf", "cloudfront"}

STATIC_EXT = (
    ".js", ".mjs", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".pdf", ".zip", ".mp4",
)


class SecurityHeadersDetector(BaseDetector):
    name = "Security Headers Detector"
    category = "Security Misconfiguration"
    cwe = "CWE-693"
    owasp = "A05:2021-Security Misconfiguration"

    MAX_HOSTS = 3

    # ------------------------------------------------------------------ utils

    @staticmethod
    def _is_document_candidate(url: str) -> bool:
        path = urlparse(url).path.lower()
        return not path.endswith(STATIC_EXT)

    @staticmethod
    def _observed_security_headers(headers_lower: dict) -> dict:
        return {k: v for k, v in headers_lower.items() if k in SECURITY_HEADER_NAMES}

    def _evidence(self, url, req_result, headers_lower, description) -> Evidence:
        """Evidence that always shows what the server actually returned."""
        observed = self._observed_security_headers(headers_lower)
        observed_txt = (
            "\n".join(f"{k}: {v}" for k, v in sorted(observed.items()))
            if observed else "(no security headers present in the response)"
        )
        return Evidence(
            description=(
                f"{description}\n\n"
                f"Request : GET {url}\n"
                f"Response: HTTP {req_result.status_code} "
                f"({headers_lower.get('content-type', 'unknown content-type')})\n"
                f"Security headers observed on this response:\n{observed_txt}"
            ),
            request=RequestEvidence(method="GET", url=url),
            response=ResponseEvidence(
                status_code=req_result.status_code,
                headers=req_result.headers,
            ),
        )

    def _finding(self, *, title, description, severity, cwe, score, vector,
                 remediation, confidence_reason, url, req_result, headers_lower,
                 evidence_description, owasp=None) -> StandardFinding:
        return StandardFinding(
            title=title,
            description=description,
            severity=severity,
            cwe=cwe,
            owasp=owasp or self.owasp,
            cvss=CVSSInfo(score=score, vector=vector, severity=severity.upper()),
            confidence=ConfidenceResult(ConfidenceLevel.CONFIRMED, confidence_reason),
            remediation=remediation,
            endpoint=url,
            method="GET",
            evidence=[self._evidence(url, req_result, headers_lower, evidence_description)],
        )

    # ------------------------------------------------------------------- main

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        result.test_state = TestState.PASS

        candidates = [ep.url for ep in endpoints if self._is_document_candidate(ep.url)] if endpoints else []
        if not candidates:
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "No HTML documents available to audit."
            return result

        tested_hosts = set()

        for url in candidates:
            host = urlparse(url).netloc
            if not host or host in tested_hosts:
                continue
            if len(tested_hosts) >= self.MAX_HOSTS:
                break

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
            content_type = headers_lower.get("content-type", "").lower()

            # Only HTML documents are in scope for browser security headers.
            if "text/html" not in content_type:
                continue
            # Redirects and error pages are not representative.
            if req_result.status_code >= 400 or 300 <= req_result.status_code < 400:
                continue

            tested_hosts.add(host)
            body = (req_result.body or "")[:200000]
            findings_before = len(result.findings)

            csp = headers_lower.get("content-security-policy", "")
            csp_report_only = headers_lower.get("content-security-policy-report-only", "")
            meta_csp = bool(
                re.search(r'<meta[^>]+http-equiv=["\']?content-security-policy', body, re.I)
            )
            xfo = headers_lower.get("x-frame-options", "")

            # 1. HSTS — only meaningful over HTTPS.
            if url.lower().startswith("https://") and "strict-transport-security" not in headers_lower:
                result.findings.append(self._finding(
                    title="Missing Strict-Transport-Security (HSTS) Header",
                    description=(
                        "This HTTPS page is served without a Strict-Transport-Security header. "
                        "A browser that first reaches the site over http:// (typed address, old link, "
                        "hostile Wi-Fi) has no instruction to upgrade to HTTPS, so an attacker on the "
                        "network can keep the victim on plaintext HTTP and read or modify the traffic "
                        "(SSL-stripping)."
                    ),
                    severity="Medium", cwe="CWE-319", score=5.3,
                    vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:L/A:N",
                    remediation="Send 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' on every HTTPS response.",
                    confidence_reason="HTTPS response returned with no Strict-Transport-Security header.",
                    evidence_description="The HTTPS response contains no 'Strict-Transport-Security' header, so the browser will not remember to force HTTPS on the next visit.",
                    url=url, req_result=req_result, headers_lower=headers_lower,
                ))

            # 2. CSP — a report-only policy or meta tag counts as partial coverage.
            if not csp and not meta_csp:
                if csp_report_only:
                    result.findings.append(self._finding(
                        title="Content-Security-Policy Runs in Report-Only Mode",
                        description=(
                            "A Content-Security-Policy is defined but only in Report-Only mode, so violations "
                            "are logged and never blocked. Injected scripts still execute in the user's browser."
                        ),
                        severity="Low", cwe="CWE-1021", score=3.1,
                        vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
                        remediation="Once the report-only policy is clean, promote it to the enforcing 'Content-Security-Policy' header.",
                        confidence_reason="Only 'Content-Security-Policy-Report-Only' was returned.",
                        evidence_description=f"Report-only policy observed: {csp_report_only[:300]}",
                        url=url, req_result=req_result, headers_lower=headers_lower,
                    ))
                else:
                    result.findings.append(self._finding(
                        title="Missing Content-Security-Policy (CSP)",
                        description=(
                            "No Content-Security-Policy is enforced on this HTML page (no header and no "
                            "<meta http-equiv> policy in the markup). Any script that reaches the page — "
                            "through a reflected parameter, a stored value, or a compromised third-party "
                            "script — runs with full privileges and can read session data or deface the page."
                        ),
                        severity="Medium", cwe="CWE-1021", score=4.3,
                        vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
                        remediation="Add a Content-Security-Policy restricting default-src, script-src (nonce or hash based), object-src 'none' and frame-ancestors.",
                        confidence_reason="No CSP header and no CSP meta tag found in the HTML document.",
                        evidence_description="Neither a 'Content-Security-Policy' response header nor a <meta http-equiv=\"Content-Security-Policy\"> tag was found in the returned HTML.",
                        url=url, req_result=req_result, headers_lower=headers_lower,
                    ))
            elif "unsafe-inline" in csp and "script-src" in csp and "nonce-" not in csp and "sha256-" not in csp:
                result.findings.append(self._finding(
                    title="Weak Content-Security-Policy (script-src allows 'unsafe-inline')",
                    description=(
                        "A CSP is enforced but script-src permits 'unsafe-inline' without a nonce or hash, "
                        "which allows injected inline <script> blocks and event handlers to execute. The "
                        "policy therefore provides little protection against XSS."
                    ),
                    severity="Low", cwe="CWE-1021", score=3.7,
                    vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
                    remediation="Remove 'unsafe-inline' from script-src and use per-response nonces or script hashes.",
                    confidence_reason="Enforced CSP contains 'unsafe-inline' in script-src with no nonce/hash source.",
                    evidence_description=f"Enforced policy observed: {csp[:300]}",
                    url=url, req_result=req_result, headers_lower=headers_lower,
                ))

            # 3. Clickjacking — CSP frame-ancestors supersedes X-Frame-Options.
            frame_ancestors = "frame-ancestors" in csp or "frame-ancestors" in csp_report_only
            valid_xfo = xfo.strip().lower().startswith(("deny", "sameorigin"))
            if not frame_ancestors and not valid_xfo:
                result.findings.append(self._finding(
                    title="Missing Clickjacking Protection",
                    description=(
                        "The page can be loaded inside an <iframe> on any third-party origin: there is no "
                        "X-Frame-Options header and no CSP 'frame-ancestors' directive. An attacker can "
                        "overlay an invisible copy of this page on their own site and trick a logged-in "
                        "user into clicking actions they cannot see (clickjacking / UI redress)."
                    ),
                    severity="Medium", cwe="CWE-1021", score=4.3,
                    vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N",
                    remediation="Send 'X-Frame-Options: DENY' (or SAMEORIGIN) and/or a CSP 'frame-ancestors 'self'' directive.",
                    confidence_reason=(
                        f"No CSP frame-ancestors directive and X-Frame-Options is "
                        f"{'absent' if not xfo else repr(xfo) + ' (not a valid value)'}."
                    ),
                    evidence_description="Neither 'X-Frame-Options' nor a CSP 'frame-ancestors' directive was returned, so framing by any origin is allowed.",
                    url=url, req_result=req_result, headers_lower=headers_lower,
                ))

            # 4. MIME sniffing.
            if headers_lower.get("x-content-type-options", "").strip().lower() != "nosniff":
                result.findings.append(self._finding(
                    title="Missing X-Content-Type-Options: nosniff",
                    description=(
                        "Responses are served without 'X-Content-Type-Options: nosniff'. Legacy browsers "
                        "may ignore the declared Content-Type and guess it from the bytes, so a file that "
                        "the application stores as text or an upload could be interpreted and executed as "
                        "HTML or JavaScript in the site's own origin."
                    ),
                    severity="Low", cwe="CWE-430", score=3.1,
                    vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N",
                    remediation="Add 'X-Content-Type-Options: nosniff' to all responses.",
                    confidence_reason="Header absent or set to a value other than 'nosniff'.",
                    evidence_description="The response did not include 'X-Content-Type-Options: nosniff'.",
                    url=url, req_result=req_result, headers_lower=headers_lower,
                ))

            # 5. Referrer-Policy — only a real issue when the default is unsafe.
            referrer = headers_lower.get("referrer-policy", "").strip().lower()
            if not referrer:
                result.findings.append(self._finding(
                    title="Missing Referrer-Policy Header",
                    description=(
                        "No Referrer-Policy is set, so the browser falls back to its default. When this page "
                        "links out to a third-party site, the full URL of the current page — including any "
                        "identifiers, tokens or search terms in the path or query string — is sent in the "
                        "Referer request header to that third party."
                    ),
                    severity="Low", cwe="CWE-200", score=3.1,
                    vector="CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N",
                    remediation="Add 'Referrer-Policy: strict-origin-when-cross-origin' (or 'no-referrer' for sensitive areas).",
                    confidence_reason="No Referrer-Policy header returned.",
                    evidence_description="The response contains no 'Referrer-Policy' header.",
                    url=url, req_result=req_result, headers_lower=headers_lower,
                ))

            # 6. Version disclosure — only when a version number is actually leaked.
            disclosed = []
            for h in DISCLOSURE_HEADERS:
                value = headers_lower.get(h, "").strip()
                if not value:
                    continue
                if value.lower() in BENIGN_BANNERS:
                    continue
                if h == "server" and not VERSION_RE.search(value):
                    # e.g. "nginx" or "cloudflare" with no version → not actionable
                    continue
                disclosed.append(f"{h}: {value}")

            if disclosed:
                result.findings.append(self._finding(
                    title="Software Version Disclosure in Response Headers",
                    description=(
                        "The server advertises its software and exact version in response headers: "
                        + "; ".join(disclosed) +
                        ". An attacker can look this version up against public CVE databases and go "
                        "straight to exploits known to work against that build, with no probing required."
                    ),
                    severity="Low", cwe="CWE-200", score=3.7,
                    vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
                    remediation="Suppress or genericise the Server / X-Powered-By / X-AspNet-Version banners at the web server or proxy layer.",
                    confidence_reason=f"Version banner observed: {', '.join(disclosed)}",
                    evidence_description="Disclosed banners:\n" + "\n".join(disclosed),
                    url=url, req_result=req_result, headers_lower=headers_lower,
                    owasp="A05:2021-Security Misconfiguration",
                ))

            if len(result.findings) > findings_before:
                result.test_state = TestState.VULNERABLE

        if not tested_hosts and result.test_state == TestState.PASS:
            result.test_state = TestState.NOT_APPLICABLE
            result.details = "No HTML document response could be audited."
        elif not result.findings and result.test_state == TestState.PASS:
            result.details = f"All baseline security headers present on {len(tested_hosts)} host(s)."
        elif result.findings:
            result.details = f"{len(result.findings)} header issue(s) across {len(tested_hosts)} host(s)."

        return result
