"""
Base Detector — abstract class that all detectors must extend.

Enforces: consistent interface, error wrapping, state management.
Errors always become ERROR state, never PASS.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, TYPE_CHECKING
import traceback

from ..models.test_state import TestState
from ..models.finding import StandardFinding

if TYPE_CHECKING:
    from ..engine.request_engine import RequestEngine
    from ..engine.auth_context import AuthContext
    from ..engine.baseline import BaselineMeasurer
    from ..models.endpoint import EndpointInfo


@dataclass
class DetectorResult:
    """Result from running a detector."""
    test_state: TestState = TestState.NOT_TESTED
    findings: List[StandardFinding] = field(default_factory=list)
    details: str = ""
    endpoints_tested: int = 0
    endpoints_blocked: int = 0

    @property
    def has_findings(self) -> bool:
        return len(self.findings) > 0

    def to_dict(self) -> dict:
        return {
            "state": self.test_state.value,
            "findings_count": len(self.findings),
            "details": self.details,
            "endpoints_tested": self.endpoints_tested,
            "endpoints_blocked": self.endpoints_blocked,
        }


class BaseDetector(ABC):
    """Abstract base class for all security detectors."""

    name: str = "BaseDetector"
    category: str = "General"
    cwe: str = ""
    owasp: str = ""

    @abstractmethod
    def _run(
        self,
        endpoints: List["EndpointInfo"],
        engine: "RequestEngine",
        auth_context: "AuthContext",
        baseline_measurer: "BaselineMeasurer",
    ) -> DetectorResult:
        """Internal run method — implemented by each detector."""
        ...

    def run(
        self,
        endpoints: List["EndpointInfo"],
        engine: "RequestEngine",
        auth_context: "AuthContext",
        baseline_measurer: "BaselineMeasurer",
    ) -> DetectorResult:
        """Execute the detector with error wrapping.

        Exceptions become ERROR state, never PASS.
        """
        try:
            result = self._run(endpoints, engine, auth_context, baseline_measurer)

            # Validate: if no endpoints were tested and state is PASS, correct to NOT_TESTED
            if result.test_state == TestState.PASS and result.endpoints_tested == 0:
                result.test_state = TestState.NOT_TESTED
                result.details = "No testable endpoints found"

            # If all endpoints were blocked, override to BLOCKED
            if (result.endpoints_tested > 0
                    and result.endpoints_blocked >= result.endpoints_tested
                    and result.test_state == TestState.PASS):
                result.test_state = TestState.BLOCKED
                result.details = f"All {result.endpoints_blocked} endpoints blocked by WAF"

            return result

        except Exception as e:
            tb = traceback.format_exc()
            return DetectorResult(
                test_state=TestState.ERROR,
                details=f"{self.name} crashed: {type(e).__name__}: {str(e)[:200]}",
            )
