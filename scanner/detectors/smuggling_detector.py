"""HTTP Request Smuggling Detector — NOT_IMPLEMENTED stub."""
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState

class SmugglingDetector(BaseDetector):
    name = "HTTP Request Smuggling"
    category = "Injection"
    cwe = "CWE-444"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        return DetectorResult(
            test_state=TestState.NOT_IMPLEMENTED,
            details="HTTP Request Smuggling detection requires specialized infrastructure "
                    "(dual front-end/back-end servers with CL/TE ambiguity testing) "
                    "that cannot be reliably automated in a standard DAST scanner."
        )
