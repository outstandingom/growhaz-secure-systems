"""
Standard Finding Model — consistent schema for every vulnerability finding.

Every finding includes: identity, evidence, confidence, CVSS, OWASP, CWE,
remediation, and test metadata.
"""

import uuid
import datetime
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .test_state import TestState
from .confidence import ConfidenceLevel, ConfidenceResult
from .evidence import Evidence


@dataclass
class CVSSInfo:
    """CVSS v3.1 scoring data for a finding."""
    score: float = 0.0
    vector: str = ""
    severity: str = "NONE"  # NONE, LOW, MEDIUM, HIGH, CRITICAL
    is_estimated: bool = True

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "vector": self.vector,
            "severity": self.severity,
            "is_estimated": self.is_estimated,
        }


@dataclass
class StandardFinding:
    """Consistent vulnerability finding schema used by all detectors."""

    # Identity
    finding_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    vulnerability: str = ""
    category: str = ""

    # Severity & confidence
    severity: str = "INFO"  # INFO, LOW, MEDIUM, HIGH, CRITICAL
    confidence: ConfidenceResult = field(default_factory=lambda: ConfidenceResult(0.0, ConfidenceLevel.LOW))
    status: TestState = TestState.VULNERABLE

    # Location
    endpoint: str = ""
    method: str = ""
    parameter: str = ""
    payload: str = ""

    # Evidence
    evidence: List[Evidence] = field(default_factory=list)

    # Scoring
    cvss: CVSSInfo = field(default_factory=CVSSInfo)
    owasp: str = ""
    cwe: str = ""

    # Remediation
    remediation: str = ""

    # Metadata
    timestamp: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    test_run_id: str = ""

    def to_dict(self) -> dict:
        return {
            "finding_id": self.finding_id,
            "vulnerability": self.vulnerability,
            "category": self.category,
            "severity": self.severity,
            "confidence": self.confidence.to_dict(),
            "status": self.status.value,
            "endpoint": self.endpoint,
            "method": self.method,
            "parameter": self.parameter,
            "payload": self.payload,
            "evidence": [e.to_dict() for e in self.evidence],
            "cvss": self.cvss.to_dict(),
            "owasp": self.owasp,
            "cwe": self.cwe,
            "remediation": self.remediation,
            "timestamp": self.timestamp,
            "test_run_id": self.test_run_id,
        }
