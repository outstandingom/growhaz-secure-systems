"""Supply Chain Risk Detector — NOT_IMPLEMENTED stub."""
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState

class SupplyChainDetector(BaseDetector):
    name = "Supply Chain Risk"
    category = "Vulnerable and Outdated Components"
    cwe = "CWE-1395"
    owasp = "A06:2021 - Vulnerable and Outdated Components"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        return DetectorResult(
            test_state=TestState.NOT_IMPLEMENTED,
            details="Supply chain risk analysis requires dependency manifest parsing "
                    "(package.json, requirements.txt, pom.xml) and CVE database lookups. "
                    "Use dedicated SCA tools (e.g., Snyk, npm audit, pip-audit)."
        )
