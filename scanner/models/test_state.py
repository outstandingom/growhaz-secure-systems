"""
Test State Model — replaces simplistic SECURE/VULNERABLE binary.

Critical rule: A failed request, exception, timeout, WAF block, missing
authentication, or unavailable endpoint must NEVER automatically become PASS.
"""

from enum import Enum


class TestState(Enum):
    """Represents the outcome of a security test."""

    NOT_TESTED = "NOT_TESTED"
    """Test was registered but not executed (e.g., prerequisites not met)."""

    PASS = "PASS"
    """Test completed with negative evidence — no vulnerability detected."""

    VULNERABLE = "VULNERABLE"
    """Confirmed exploit behavior with sufficient evidence."""

    INCONCLUSIVE = "INCONCLUSIVE"
    """Test ran but results are ambiguous (timeout, inconsistent responses)."""

    BLOCKED = "BLOCKED"
    """WAF/firewall blocked the test payloads."""

    ERROR = "ERROR"
    """Detector crashed or encountered an unrecoverable error."""

    NOT_APPLICABLE = "NOT_APPLICABLE"
    """Feature/endpoint not present on the target (e.g., no SSL on HTTP site)."""

    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    """Detector exists in registry but detection logic is not yet reliable."""

    @property
    def is_negative(self) -> bool:
        """Returns True if the state indicates no vulnerability was found."""
        return self in (TestState.PASS, TestState.NOT_APPLICABLE)

    @property
    def is_actionable(self) -> bool:
        """Returns True if the state requires attention."""
        return self in (TestState.VULNERABLE, TestState.INCONCLUSIVE, TestState.ERROR)

    @property
    def counts_as_tested(self) -> bool:
        """Returns True if the test actually executed (vs skipped)."""
        return self not in (TestState.NOT_TESTED, TestState.NOT_IMPLEMENTED)
