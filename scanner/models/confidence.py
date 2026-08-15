"""
Confidence scoring for vulnerability findings.

Confidence is separate from severity — a HIGH severity finding with LOW
confidence is less actionable than a MEDIUM severity finding with CONFIRMED
confidence.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Union, Any


class ConfidenceLevel(Enum):
    """Qualitative confidence classification."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CONFIRMED = "CONFIRMED"


class ConfidenceResult:
    """Captures confidence scoring for a finding."""

    def __init__(
        self,
        arg1: Union[float, ConfidenceLevel, str] = 0.5,
        arg2: Union[ConfidenceLevel, str, List[str]] = ConfidenceLevel.MEDIUM,
        signals: List[str] = None,
        validation_method: str = ""
    ):
        if isinstance(arg1, (ConfidenceLevel, str)) and not isinstance(arg1, (int, float)):
            # Called as ConfidenceResult(level, details_or_signal)
            self.level = arg1 if isinstance(arg1, ConfidenceLevel) else self._parse_level(arg1)
            self.score = self._default_score(self.level)
            if isinstance(arg2, str):
                self.signals = [arg2]
            elif isinstance(arg2, list):
                self.signals = arg2
            else:
                self.signals = signals or []
        else:
            # Called as ConfidenceResult(score, level, ...)
            self.score = float(arg1) if isinstance(arg1, (int, float)) else 0.5
            self.level = arg2 if isinstance(arg2, ConfidenceLevel) else self._parse_level(arg2)
            self.signals = signals or []

        self.validation_method = validation_method

    @staticmethod
    def _parse_level(val: Any) -> ConfidenceLevel:
        if isinstance(val, ConfidenceLevel):
            return val
        s = str(val).upper()
        if "CONFIRM" in s:
            return ConfidenceLevel.CONFIRMED
        elif "HIGH" in s:
            return ConfidenceLevel.HIGH
        elif "MED" in s:
            return ConfidenceLevel.MEDIUM
        return ConfidenceLevel.LOW

    @staticmethod
    def _default_score(lvl: ConfidenceLevel) -> float:
        if lvl == ConfidenceLevel.CONFIRMED:
            return 1.0
        elif lvl == ConfidenceLevel.HIGH:
            return 0.85
        elif lvl == ConfidenceLevel.MEDIUM:
            return 0.6
        return 0.3

    @staticmethod
    def from_signals(signals: List[str]) -> "ConfidenceResult":
        count = len(signals)
        if count == 0:
            return ConfidenceResult(
                score=0.0, level=ConfidenceLevel.LOW,
                signals=signals, validation_method="no_signals"
            )

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
        level_val = self.level.value if isinstance(self.level, ConfidenceLevel) else str(self.level)
        return {
            "score": self.score,
            "level": level_val,
            "signals": self.signals,
            "validation_method": self.validation_method,
        }
