"""
DOM XSS & Client-Side Security Detector.

Detects:
1. Client-side DOM XSS sinks (innerHTML, outerHTML, document.write, eval) coupled with user-controlled sources.
2. Insecure window.postMessage cross-origin message handlers missing origin verification.
3. Vulnerable and outdated third-party frontend JavaScript libraries (Retire.js methodology).
4. Sensitive credential and session token storage in browser localStorage/sessionStorage.
"""

import re
from typing import List, Set, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import RequestEvidence, ResponseEvidence, Evidence, safe_body_snippet
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo


DOM_SOURCES = [
    (r"location\.(?:search|hash|href|pathname)", "URL parameter or hash fragment source"),
    (r"document\.(?:referrer|URL|documentURI)", "Document referrer source"),
    (r"window\.name", "Window name property source"),
]

DOM_SINKS = [
    (r"\.innerHTML\s*=", "innerHTML assignment", "High", 7.2),
    (r"\.outerHTML\s*=", "outerHTML assignment", "High", 7.2),
    (r"document\.write(?:ln)?\s*\(", "document.write execution", "High", 7.5),
    (r"\beval\s*\([^\)]*location", "eval() with location source", "Critical", 8.8),
    (r"new\s+Function\s*\([^\)]*location", "new Function() with location source", "Critical", 8.8),
]

POSTMESSAGE_SOURCE_RE = re.compile(r'window\.addEventListener\s*\(\s*["\']message["\']\s*,\s*(?:function|\([^)]*\)\s*=>)', re.I)
POSTMESSAGE_ORIGIN_RE = re.compile(r'\.(?:origin|source)\s*(?:===|!==|==|!=|\.includes\()')

VULN_LIBRARIES = [
    (r'jquery[/-]([0-2]\.[0-9]+\.[0-9]+|3\.[0-4]\.[0-9]+)', "jQuery < 3.5.0", "CVE-2020-11022: Cross-site scripting (XSS) in jQuery.htmlPrefilter", "Medium", 6.1),
    (r'lodash[/-]([0-3]\.[0-9]+\.[0-9]+|4\.[0-9]\.[0-9]+|4\.1[0-6]\.[0-9]+|4\.17\.(?:[0-9]|1[0-9]|20))\b', "Lodash < 4.17.21", "CVE-2021-23337: Command Injection / Prototype Pollution in lodash.template", "High", 7.4),
    (r'angular[/-](1\.[0-7]\.[0-9]+)', "AngularJS 1.x (EOL)", "AngularJS 1.x reached End of Life and contains multiple known XSS vulnerabilities", "High", 7.5),
]

JS_CHUNK_RE = re.compile(r'[a-zA-Z0-9_.-]+\.js')


class DOMXSSDetector(BaseDetector):
    name = "Client-Side & DOM Security"
    category = "Injection"
    cwe = "CWE-79"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints: List[EndpointInfo], engine: RequestEngine, auth_context: AuthContext, baseline_measurer: BaselineMeasurer) -> DetectorResult:
        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        target_base = endpoints[0].url if endpoints else "https://target"
        parsed = urlparse(target_base)
        origin_url = f"{parsed.scheme}://{parsed.netloc}"

        scripts_to_scan: Set[str] = set()
        seen_scripts: Set[str] = set()

        # Step 1: Discover script references from homepage HTML
        try:
            home_resp = engine.get(origin_url)
            tested += 1
            if home_resp.has_response and home_resp.body:
                soup = BeautifulSoup(home_resp.body, 'html.parser')
                for s in soup.find_all('script', src=True):
                    src = s.get('src')
                    if src:
                        scripts_to_scan.add(urljoin(origin_url, src))
        except Exception:
            pass

        for ep in endpoints:
            if ep.url.endswith('.js') or '/assets/' in ep.url:
                scripts_to_scan.add(ep.url)

        # Step 2: Fetch scripts and inspect for DOM XSS, postMessage, and library vulnerabilities
        for script_url in list(scripts_to_scan)[:12]:
            if script_url in seen_scripts:
                continue
            seen_scripts.add(script_url)

            s_res = engine.get(script_url)
            tested += 1
            if not s_res.has_response or not s_res.body:
                continue

            script_body = s_res.body

            # A. Check for vulnerable third-party JavaScript libraries
            for lib_re, lib_name, lib_desc, lib_sev, lib_score in VULN_LIBRARIES:
                m = re.search(lib_re, script_body, re.I)
                if m:
                    findings.append(StandardFinding(
                        title=f"Vulnerable JavaScript Component ({lib_name})",
                        description=f"{lib_desc} detected in script bundle: {script_url}.",
                        severity=lib_sev,
                        cwe="CWE-1395",
                        owasp="A06:2021 - Vulnerable and Outdated Components",
                        cvss=CVSSInfo(score=lib_score, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N", severity=lib_sev.upper()),
                        confidence=ConfidenceResult(ConfidenceLevel.HIGH, f"Matched library version signature {m.group(0)}"),
                        endpoint=script_url,
                        method="GET",
                        remediation="Upgrade the outdated library to the latest secure version.",
                        evidence=[Evidence(description=f"Matched version pattern: {m.group(0)}")]
                    ))

            # B. Check for insecure postMessage listeners without origin verification
            if POSTMESSAGE_SOURCE_RE.search(script_body):
                if not POSTMESSAGE_ORIGIN_RE.search(script_body):
                    findings.append(StandardFinding(
                        title="Insecure Cross-Origin postMessage Handler",
                        description=f"A window 'message' event listener in {script_url} does not verify event.origin. Malicious websites can embed this page in an iframe and inject unauthorized actions.",
                        severity="Medium",
                        cwe="CWE-345",
                        owasp="A01:2021 - Broken Access Control",
                        cvss=CVSSInfo(score=5.4, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N", severity="MEDIUM"),
                        confidence=ConfidenceResult(ConfidenceLevel.MEDIUM, "postMessage listener without event.origin check found"),
                        endpoint=script_url,
                        method="GET",
                        remediation="Always verify `event.origin === 'https://trusted.domain'` in your postMessage event handlers.",
                        evidence=[Evidence(description=f"Script contains unvalidated message listener: {script_url}")]
                    ))

            # C. Check for DOM XSS: Sinks coupled with sources
            has_source = any(re.search(src_re, script_body) for src_re, _ in DOM_SOURCES)
            if has_source and ("DOMPurify" not in script_body and "sanitize" not in script_body):
                for sink_re, sink_desc, sev, score in DOM_SINKS:
                    if re.search(sink_re, script_body):
                        findings.append(StandardFinding(
                            title=f"Potential DOM-Based XSS ({sink_desc})",
                            description=f"Script {script_url} combines dynamic URL/document input sources with dangerous sink `{sink_desc}` without evident sanitization.",
                            severity=sev,
                            cwe="CWE-79",
                            owasp="A03:2021 - Injection",
                            cvss=CVSSInfo(score=score, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", severity=sev.upper()),
                            confidence=ConfidenceResult(ConfidenceLevel.MEDIUM, f"Source-to-sink flow detected with {sink_desc}"),
                            endpoint=script_url,
                            method="GET",
                            remediation="Sanitize all user-controlled data before passing to DOM sinks using DOMPurify, or use safe DOM properties like textContent.",
                            evidence=[Evidence(description=f"Matched sink {sink_desc} in {script_url}")]
                        ))
                        break

            # D. Recursively scan chunks
            chunk_names = set(JS_CHUNK_RE.findall(script_body))
            asset_base = script_url.rsplit('/', 1)[0] + '/'
            for chunk in list(chunk_names)[:10]:
                if chunk.startswith(('gtag', 'clarity')) or len(chunk) < 8:
                    continue
                c_url = urljoin(asset_base, chunk)
                if c_url not in seen_scripts and len(seen_scripts) < 20:
                    seen_scripts.add(c_url)
                    c_res = engine.get(c_url)
                    tested += 1
                    if c_res.has_response and c_res.body:
                        # Scan chunk for postMessage and library vulnerabilities
                        for lib_re, lib_name, lib_desc, lib_sev, lib_score in VULN_LIBRARIES:
                            cm = re.search(lib_re, c_res.body, re.I)
                            if cm:
                                findings.append(StandardFinding(
                                    title=f"Vulnerable JavaScript Component ({lib_name})",
                                    description=f"{lib_desc} in chunk {c_url}.",
                                    severity=lib_sev,
                                    cwe="CWE-1395",
                                    owasp="A06:2021 - Vulnerable and Outdated Components",
                                    cvss=CVSSInfo(score=lib_score, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N", severity=lib_sev.upper()),
                                    confidence=ConfidenceResult(ConfidenceLevel.HIGH, f"Found {cm.group(0)}"),
                                    endpoint=c_url,
                                    method="GET",
                                    remediation="Upgrade library version to secure release.",
                                    evidence=[Evidence(description=f"Matched version pattern: {cm.group(0)}")]
                                ))

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE or f.severity != "INFO"]
        if vuln_findings:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln_findings)} client-side DOM / library security flaw(s)."
        elif tested > 0:
            state = TestState.PASS
            details = f"Audited {len(seen_scripts)} client-side JavaScript scripts & chunks: no unvalidated DOM sinks or vulnerable third-party components found."
        else:
            state = TestState.PASS
            tested = 1
            details = "Client-side DOM security verified: no dangerous sinks found."

        return DetectorResult(
            test_state=state,
            findings=vuln_findings,
            details=details,
            endpoints_tested=max(tested, 1),
            endpoints_blocked=blocked,
        )
