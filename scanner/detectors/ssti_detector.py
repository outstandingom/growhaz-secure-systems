"""SSTI Detector — Server-Side Template Injection."""
from typing import List
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo

SSTI_PAYLOADS = [
    ("{{7*7}}", "49", "Jinja2/Twig"),
    ("${7*7}", "49", "Mako/Freemarker"),
    ("#{7*7}", "49", "Ruby ERB/Thymeleaf"),
    ("{{7*'7'}}", "7777777", "Jinja2"),
    ("<%= 7*7 %>", "49", "ERB"),
    ("${7*7}", "49", "JSP EL"),
    ("{{config}}", "config", "Jinja2 config leak"),
    ("{{self.__class__}}", "__class__", "Jinja2 class access"),
]

TEMPLATE_ERROR_SIGS = [
    "templatenotfound", "jinja2.exceptions", "mako.exceptions",
    "django.template", "templateerror", "template syntax error",
    "freemarker.core", "org.thymeleaf", "handlebars",
]

class SSTIDetector(BaseDetector):
    name = "Server-Side Template Injection (SSTI)"
    category = "Injection"
    cwe = "CWE-1336"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        testable = [ep for ep in endpoints if ep.all_params]
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No endpoints with parameters")

        for ep in testable[:15]:
            tested += 1
            params = ep.all_params[:3]
            for param in params:
                signals = []
                # Baseline
                base_data = {p: ("test" if p != param else "normalvalue") for p in params}
                baseline = engine.post(ep.url, json=base_data) if ep.method == "POST" else engine.get(ep.url, params=base_data)
                if baseline.is_blocked: blocked += 1; continue

                for payload, expected, engine_name in SSTI_PAYLOADS:
                    test_data = {p: ("test" if p != param else payload) for p in params}
                    resp = engine.post(ep.url, json=test_data) if ep.method == "POST" else engine.get(ep.url, params=test_data)
                    if resp.is_blocked: blocked += 1; continue
                    if not resp.has_response: continue

                    # Check for computed result
                    if expected in resp.body and (not baseline.has_response or expected not in baseline.body):
                        signals.append(f"template_expression_evaluated: payload={payload}, result={expected}, engine={engine_name}")

                    # Check for template error signatures
                    body_lower = resp.body.lower()
                    for sig in TEMPLATE_ERROR_SIGS:
                        if sig in body_lower and (not baseline.has_response or sig not in baseline.body.lower()):
                            signals.append(f"template_error_signature: {sig}, payload={payload}")
                            break

                if signals:
                    confidence = ConfidenceResult.from_signals(signals)
                    if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                        findings.append(StandardFinding(
                            vulnerability="Server-Side Template Injection (SSTI)", category=self.category,
                            severity="CRITICAL", confidence=confidence, status=TestState.VULNERABLE,
                            endpoint=ep.url, method=ep.method, parameter=param,
                            cvss=CVSSInfo(score=9.8, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", severity="CRITICAL"),
                            owasp=self.owasp, cwe=self.cwe,
                            remediation="Never pass user input directly to template engines. Use sandboxed rendering.",
                            evidence=[Evidence(description=s) for s in signals],
                        ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} SSTI found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
