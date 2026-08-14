"""
XSS Detector — context-aware, false-positive-resistant.

Detection approach:
1. Send unique canary to detect reflection points
2. Determine reflection context (HTML body, attribute, JS, comment)
3. Check if encoding defeats the payload
4. Context-aware confidence scoring
5. Reflection alone is NOT proof of XSS
"""

import re
import uuid
import html
from typing import List, Optional, Tuple

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, ResponseEvidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine, RequestResult
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo


# Context detection patterns
CONTEXT_PATTERNS = {
    "html_tag": re.compile(r'<[^>]*{CANARY}[^>]*>', re.IGNORECASE),
    "html_attribute": re.compile(r'([\w-]+)\s*=\s*["\'][^"\']*{CANARY}[^"\']*["\']', re.IGNORECASE),
    "script_block": re.compile(r'<script[^>]*>[^<]*{CANARY}[^<]*</script>', re.IGNORECASE | re.DOTALL),
    "html_comment": re.compile(r'<!--[^>]*{CANARY}[^>]*-->', re.IGNORECASE),
    "js_string": re.compile(r'["\'][^"\']*{CANARY}[^"\']*["\']', re.IGNORECASE),
}

# Context-specific payloads
CONTEXT_PAYLOADS = {
    "html_body": [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<details open ontoggle=alert(1)>',
    ],
    "html_attribute": [
        '" onmouseover="alert(1)" x="',
        "' onfocus='alert(1)' autofocus='",
        '" autofocus onfocus="alert(1)',
    ],
    "script_block": [
        "';alert(1);//",
        '";alert(1);//',
        "</script><script>alert(1)</script>",
    ],
    "generic": [
        "<script>alert(1)</script>",
        '"><script>alert(1)</script>',
        "<img src=x onerror=alert(1)>",
    ],
}

# Encoding check: these characters must NOT be encoded for XSS to work
CRITICAL_CHARS = {
    "html_body": ['<', '>'],
    "html_attribute": ['"', "'"],
    "script_block": ["'", '"', ';'],
}


def _detect_context(body: str, canary: str) -> Optional[str]:
    """Determine which HTML context the canary appears in."""
    for ctx_name, pattern in CONTEXT_PATTERNS.items():
        regex = re.compile(pattern.pattern.replace("{CANARY}", re.escape(canary)), pattern.flags)
        if regex.search(body):
            return ctx_name

    # Fallback: is it anywhere in the body?
    if canary in body:
        return "html_body"
    return None


def _is_encoded(body: str, payload: str, context: str) -> bool:
    """Check if critical characters in the payload are HTML-encoded in the response."""
    chars = CRITICAL_CHARS.get(context, ['<', '>'])
    # Find the payload region in the body
    idx = body.find(payload)
    if idx == -1:
        # Payload not found literally — check for encoded version
        encoded = html.escape(payload)
        if encoded in body:
            return True
        return True  # Can't find it at all, assume encoded
    return False


class XSSDetector(BaseDetector):
    name = "Cross-Site Scripting (XSS)"
    category = "Injection"
    cwe = "CWE-79"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings = []
        tested = 0
        blocked = 0

        # Filter endpoints with parameters
        testable = [ep for ep in endpoints if ep.all_params]
        if not testable:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No endpoints with injectable parameters found"
            )

        for ep in testable:
            tested += 1
            params = ep.all_params[:5]

            for param in params:
                # Step 1: Send unique canary to detect reflection
                canary = f"gxss{uuid.uuid4().hex[:8]}"
                canary_data = {p: ("test" if p != param else canary) for p in params}

                if ep.method == "POST":
                    resp = engine.post(ep.url, json=canary_data)
                else:
                    resp = engine.get(ep.url, params=canary_data)

                if resp.is_blocked:
                    blocked += 1
                    continue
                if not resp.has_response:
                    continue

                # Is canary reflected?
                if canary not in resp.body:
                    continue  # Not reflected — skip this param

                # Step 2: Determine reflection context
                context = _detect_context(resp.body, canary)
                if not context:
                    continue

                # Step 3: Send context-appropriate payloads
                payloads = CONTEXT_PAYLOADS.get(context, CONTEXT_PAYLOADS["generic"])
                ep_signals = []

                for payload in payloads:
                    payload_data = {p: ("test" if p != param else payload) for p in params}

                    if ep.method == "POST":
                        xss_resp = engine.post(ep.url, json=payload_data)
                    else:
                        xss_resp = engine.get(ep.url, params=payload_data)

                    if xss_resp.is_blocked:
                        blocked += 1
                        continue
                    if not xss_resp.has_response:
                        continue

                    # Step 4: Check if payload is reflected unencoded
                    if payload in xss_resp.body:
                        # Payload reflected literally
                        if not _is_encoded(xss_resp.body, payload, context):
                            ep_signals.append(
                                f"unencoded_reflection: context={context}, param={param}, payload={payload[:40]}"
                            )
                        else:
                            ep_signals.append(f"encoded_reflection: context={context}, param={param}")
                    elif canary in xss_resp.body:
                        # Canary reflected but payload was stripped/modified
                        ep_signals.append(f"partial_reflection: context={context}, param={param}")

                # Evaluate signals
                if ep_signals:
                    unencoded = [s for s in ep_signals if "unencoded_reflection" in s]
                    encoded = [s for s in ep_signals if "encoded_reflection" in s]

                    if unencoded:
                        confidence = ConfidenceResult.from_signals(unencoded)
                        if len(unencoded) >= 2:
                            confidence = ConfidenceResult(
                                score=0.8, level=ConfidenceLevel.HIGH,
                                signals=unencoded,
                                validation_method=f"{len(unencoded)}_unencoded_reflections_in_{context}"
                            )
                        severity = "HIGH" if context == "script_block" else "MEDIUM"
                        findings.append(StandardFinding(
                            vulnerability="Cross-Site Scripting (XSS)",
                            category="Injection",
                            severity=severity,
                            confidence=confidence,
                            status=TestState.VULNERABLE,
                            endpoint=ep.url,
                            method=ep.method,
                            parameter=param,
                            payload=unencoded[0].split("payload=")[-1][:60] if unencoded else "",
                            cvss=CVSSInfo(score=6.1, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", severity="MEDIUM"),
                            owasp=self.owasp, cwe=self.cwe,
                            remediation="Encode all user input based on output context. Use Content-Security-Policy headers.",
                            evidence=[Evidence(description=s) for s in ep_signals],
                        ))
                    elif encoded:
                        # Reflected but encoded = PASS for this param (encoding is working)
                        pass

        # Overall state
        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln_findings:
            state = TestState.VULNERABLE
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
        elif tested > 0:
            state = TestState.PASS
        else:
            state = TestState.NOT_APPLICABLE

        return DetectorResult(
            test_state=state,
            findings=vuln_findings,
            details=f"Tested {tested} endpoints. {len(vuln_findings)} XSS found, {blocked} blocked.",
            endpoints_tested=tested,
            endpoints_blocked=blocked,
        )
