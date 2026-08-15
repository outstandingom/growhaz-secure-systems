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
    title: str = ""
    description: str = ""
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

    def __post_init__(self):
        if not self.vulnerability and self.title:
            self.vulnerability = self.title
        elif not self.title and self.vulnerability:
            self.title = self.vulnerability

    def to_dict(self) -> dict:
        return {
            "finding_id": self.finding_id,
            "vulnerability": self.vulnerability or self.title,
            "title": self.title or self.vulnerability,
            "description": self.description,
            "category": self.category,
            "severity": self.severity,
            "confidence": self.confidence.to_dict() if hasattr(self.confidence, 'to_dict') else str(self.confidence),
            "status": self.status.value if isinstance(self.status, TestState) else str(self.status),
            "endpoint": self.endpoint,
            "method": self.method,
            "parameter": self.parameter,
            "payload": self.payload,
            "evidence": [e.to_dict() if hasattr(e, 'to_dict') else str(e) for e in self.evidence],
            "cvss": self.cvss.to_dict() if hasattr(self.cvss, 'to_dict') else str(self.cvss),
            "cvss_score": self.cvss.score if hasattr(self.cvss, 'score') else 0.0,
            "owasp": self.owasp,
            "cwe": self.cwe,
            "remediation": self.remediation,
            "timestamp": self.timestamp,
            "test_run_id": self.test_run_id,
        }
