"""
Confidence scoring for vulnerability findings.

Confidence is separate from severity — a HIGH severity finding with LOW
confidence is less actionable than a MEDIUM severity finding with CONFIRMED
confidence.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List


class ConfidenceLevel(Enum):
    """Qualitative confidence classification."""

    LOW = "LOW"
    """Single weak signal (e.g., one anomalous response)."""

    MEDIUM = "MEDIUM"
    """Multiple corroborating signals."""

    HIGH = "HIGH"
    """Strong evidence from validated detection (e.g., error signature + reproducible)."""

    CONFIRMED = "CONFIRMED"
    """Exploit behavior confirmed (e.g., DB error string, browser-confirmed XSS)."""


@dataclass
class ConfidenceResult:
    """Captures confidence scoring for a finding."""

    score: float  # 0.0 to 1.0
    level: ConfidenceLevel
    signals: List[str] = field(default_factory=list)
    validation_method: str = ""

    @staticmethod
    def from_signals(signals: List[str]) -> "ConfidenceResult":
        """Calculate confidence from a list of evidence signals.

        Each signal is a short description of what was observed.
        More signals = higher confidence.
        """
        count = len(signals)
        if count == 0:
            return ConfidenceResult(
                score=0.0, level=ConfidenceLevel.LOW,
                signals=signals, validation_method="no_signals"
            )

        # Weight known strong signals
        strong_signals = [
            "db_error_signature", "browser_confirmed", "timing_statistical",
            "cross_user_access_confirmed", "template_expression_evaluated",
            "entity_expanded", "redirect_to_external", "file_content_leaked",
            "token_accepted_without_signature", "error_based_confirmed"
        ]
        strong_count = sum(1 for s in signals if any(ss in s for ss in strong_signals))

        if strong_count >= 2 or (strong_count >= 1 and count >= 3):
            score = min(1.0, 0.85 + strong_count * 0.05)
            level = ConfidenceLevel.CONFIRMED
        elif strong_count >= 1 or count >= 3:
            score = min(0.85, 0.6 + count * 0.05)
            level = ConfidenceLevel.HIGH
        elif count >= 2:
            score = min(0.6, 0.3 + count * 0.1)
            level = ConfidenceLevel.MEDIUM
        else:
            score = min(0.3, 0.1 + count * 0.1)
            level = ConfidenceLevel.LOW

        method = f"{count}_signals"
        if strong_count > 0:
            method += f"_{strong_count}_strong"

        return ConfidenceResult(
            score=round(score, 2), level=level,
            signals=signals, validation_method=method
        )

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "level": self.level.value,
            "signals": self.signals,
            "validation_method": self.validation_method,
        }
