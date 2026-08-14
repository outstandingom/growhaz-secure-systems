"""Error/Exception Disclosure Detector."""
import re
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer

ERROR_TRIGGERS = [
    {"params": {"id": "' OR 1=1 --"}, "method": "GET"},
    {"params": {"page": "-1"}, "method": "GET"},
    {"params": {"id": "99999999"}, "method": "GET"},
    {"json": {"email": None, "password": None}, "method": "POST"},
    {"json": {"__invalid": True}, "method": "POST"},
    {"data": "{{invalid}}", "method": "POST", "content_type": "text/plain"},
]

ERROR_PATTERNS = [
    (r"Traceback \(most recent call last\)", "python_traceback"),
    (r"File \".*\.py\",\s+line \d+", "python_file_path"),
    (r"at [\w$.]+\([\w]+\.java:\d+\)", "java_stacktrace"),
    (r"at [\w$.]+\.[\w]+\(.*:\d+:\d+\)", "node_stacktrace"),
    (r"Fatal error:.*\.php:\d+", "php_error"),
    (r"Warning:.*\.php on line \d+", "php_warning"),
    (r"Exception in thread", "java_exception"),
    (r"System\.(\w+)Exception", "dotnet_exception"),
    (r"Stack trace:", "generic_stacktrace"),
    (r"DEBUG\s*=\s*True", "django_debug"),
    (r"SQLSTATE\[", "sql_state"),
    (r"\/[\w\/]+\.py", "python_path_leak"),
    (r"\/[\w\/]+\.php", "php_path_leak"),
    (r"\/[\w\/]+\.java", "java_path_leak"),
    (r"node_modules\/", "node_modules_leak"),
    (r"at Object\.<anonymous>", "node_anonymous"),
    (r"X-Powered-By:\s*Express", "express_disclosure"),
    (r"Server:\s*\w+/[\d.]+", "server_version_leak"),
]

VERSION_PATTERNS = [
    (r"Django/[\d.]+", "django"),
    (r"PHP/[\d.]+", "php"),
    (r"Apache/[\d.]+", "apache"),
    (r"nginx/[\d.]+", "nginx"),
    (r"Express/[\d.]+", "express"),
    (r"ASP\.NET\s+[\d.]+", "aspnet"),
]

class ErrorDisclosureDetector(BaseDetector):
    name = "Error/Exception Disclosure"
    category = "Security Misconfiguration"
    cwe = "CWE-209"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        testable = endpoints[:20] if endpoints else []
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No endpoints to test")

        for ep in testable:
            tested += 1
            signals = []

            for trigger in ERROR_TRIGGERS:
                method = trigger.get("method", ep.method)
                kwargs = {}
                if "params" in trigger:
                    kwargs["params"] = trigger["params"]
                if "json" in trigger:
                    kwargs["json"] = trigger["json"]
                if "data" in trigger:
                    kwargs["data"] = trigger["data"]
                if "content_type" in trigger:
                    kwargs["headers"] = {"Content-Type": trigger["content_type"]}

                resp = engine.request(method, ep.url, **kwargs)
                if resp.is_blocked: blocked += 1; continue
                if not resp.has_response: continue
                if resp.status_code < 400: continue  # Only check error responses

                body = resp.body
                for pattern, pattern_name in ERROR_PATTERNS:
                    if re.search(pattern, body, re.IGNORECASE):
                        signals.append(f"error_based_confirmed: {pattern_name}")

                for pattern, fw_name in VERSION_PATTERNS:
                    match = re.search(pattern, body, re.IGNORECASE)
                    if match:
                        signals.append(f"framework_version_disclosed: {fw_name}={match.group(0)}")

                # Check response headers too
                for hdr_name, hdr_val in resp.headers.items():
                    for pattern, fw_name in VERSION_PATTERNS:
                        match = re.search(pattern, hdr_val, re.IGNORECASE)
                        if match:
                            signals.append(f"header_version_disclosed: {hdr_name}={match.group(0)}")

                if signals:
                    break  # Found errors, no need to try more triggers

            if signals:
                unique_signals = list(set(signals))
                confidence = ConfidenceResult.from_signals(unique_signals)
                sev = "MEDIUM" if any("stacktrace" in s or "traceback" in s for s in unique_signals) else "LOW"
                findings.append(StandardFinding(
                    vulnerability="Error/Exception Disclosure", category=self.category,
                    severity=sev, confidence=confidence, status=TestState.VULNERABLE,
                    endpoint=ep.url, method=ep.method,
                    cvss=CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="MEDIUM"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Disable debug mode in production. Use generic error pages. Log details server-side only.",
                    evidence=[Evidence(description=s) for s in unique_signals[:5]],
                ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} disclosure issues.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
