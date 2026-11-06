"""SSRF Detector — in-band server-side request forgery detection."""
from typing import List
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo

SSRF_PARAMS = ['url', 'uri', 'path', 'src', 'dest', 'redirect', 'link', 'feed',
               'host', 'site', 'html', 'data', 'reference', 'callback', 'return',
               'page', 'fetch', 'proxy', 'target', 'domain', 'load', 'file', 'val', 'webhook']

SSRF_PAYLOADS = [
    ("http://127.0.0.1", ["localhost", "127.0.0.1", "root:", "<!doctype"]),
    ("http://127.0.0.1:22", ["ssh", "openssh", "connection refused"]),
    ("http://[::1]", ["localhost", "root:", "<!doctype"]),
    ("http://169.254.169.254/latest/meta-data/", ["ami-id", "instance-id", "instance-type", "iam"]),
    ("http://metadata.google.internal/computeMetadata/v1/", ["attributes", "instance"]),
    ("http://169.254.169.254/metadata/instance", ["compute", "network"]),
]


class SSRFDetector(BaseDetector):
    name = "Server-Side Request Forgery (SSRF)"
    category = "Server-Side Request Forgery"
    cwe = "CWE-918"
    owasp = "A10:2021 - Server-Side Request Forgery (SSRF)"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        testable = [ep for ep in endpoints if any(p in ep.all_params for p in SSRF_PARAMS)]
        if not testable:
            testable = [ep for ep in endpoints if ep.all_params and ep.method in ("GET", "POST")][:5]
        if not testable:
            target_base = endpoints[0].url if endpoints else "https://target"
            parsed_base = urlparse(target_base)
            origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
            ssrf_probe_paths = ["/", "/api/fetch", "/api/proxy", "/api/webhook", "/api/preview", "/api/tools"]
            common_ssrf_params = ["url", "dest", "target", "src", "link"]
            testable = [
                EndpointInfo(url=urljoin(origin_url, path), method="GET", query_params=common_ssrf_params)
                for path in ssrf_probe_paths
            ]

        for ep in testable[:8]:
            tested += 1
            ssrf_params = [p for p in ep.all_params if p.lower() in SSRF_PARAMS] or (ep.all_params[:2] if ep.all_params else ["url", "target"])
            for param in ssrf_params:
                # Baseline with benign URL
                base_data = {p: ("test" if p != param else "https://www.example.com") for p in ssrf_params}
                baseline = engine.post(ep.url, json=base_data) if ep.method == "POST" else engine.get(ep.url, params=base_data)
                if baseline.is_blocked:
                    blocked += 1
                    continue

                signals = []
                for payload, indicators in SSRF_PAYLOADS:
                    test_data = {p: ("test" if p != param else payload) for p in ssrf_params}
                    resp = engine.post(ep.url, json=test_data) if ep.method == "POST" else engine.get(ep.url, params=test_data)
                    if resp.is_blocked:
                        blocked += 1
                        continue
                    if not resp.has_response:
                        continue

                    body_lower = resp.body.lower()
                    matched = [ind for ind in indicators if ind.lower() in body_lower]
                    if matched and (not baseline.has_response or all(ind.lower() not in baseline.body.lower() for ind in matched)):
                        signals.append(f"ssrf_indicator_matched: payload={payload}, indicators={matched}")

                if signals:
                    confidence = ConfidenceResult.from_signals(signals)
                    if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                        findings.append(StandardFinding(
                            vulnerability="Server-Side Request Forgery (SSRF)", category=self.category,
                            severity="CRITICAL", confidence=confidence, status=TestState.VULNERABLE,
                            endpoint=ep.url, method=ep.method, parameter=param,
                            cvss=CVSSInfo(score=8.6, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N", severity="HIGH"),
                            owasp=self.owasp, cwe=self.cwe,
                            remediation="Do not make server-side requests to user-supplied URLs without an IP address whitelist and disabling redirection.",
                            evidence=[Evidence(description=s) for s in signals],
                        ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = (TestState.VULNERABLE if vuln
                 else (TestState.BLOCKED if blocked >= tested and tested > 0
                 else (TestState.PASS if tested > 0 else TestState.PASS)))
        details = (f"Detected {len(vuln)} SSRF vulnerability/vulnerabilities." if vuln
                   else f"Tested {tested} endpoints against internal cloud metadata and loopback IP addresses: SSRF attempts are blocked or unhandled.")
        return DetectorResult(test_state=state, findings=vuln if vuln else findings, details=details,
                              endpoints_tested=max(tested, 1), endpoints_blocked=blocked)
