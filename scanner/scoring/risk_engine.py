from typing import List, Dict
from scanner.models.finding import StandardFinding
from scanner.models.confidence import ConfidenceLevel

class RiskEngine:
    def __init__(self):
        self.findings: List[StandardFinding] = []

    def add_findings(self, findings: List[StandardFinding]):
        for finding in findings:
            if not self._is_duplicate(finding):
                self.findings.append(finding)

    def _is_duplicate(self, new_finding: StandardFinding) -> bool:
        for f in self.findings:
            if f.vuln_type == new_finding.vuln_type and f.endpoint == new_finding.endpoint:
                return True
        return False

    def calculate_overall_risk(self) -> str:
        if not self.findings:
            return "INFO"
            
        critical_count = 0
        high_count = 0
        medium_count = 0
        
        for f in self.findings:
            # Adjust effective severity based on confidence
            eff_severity = getattr(f, 'severity', 'INFO')
            if getattr(f.confidence, 'level', ConfidenceLevel.LOW) == ConfidenceLevel.LOW:
                if eff_severity == "CRITICAL": eff_severity = "HIGH"
                elif eff_severity == "HIGH": eff_severity = "MEDIUM"
                
            if eff_severity == "CRITICAL": critical_count += 1
            elif eff_severity == "HIGH": high_count += 1
            elif eff_severity == "MEDIUM": medium_count += 1
            
        if critical_count > 0: return "CRITICAL"
        if high_count > 0: return "HIGH"
        if medium_count > 0: return "MEDIUM"
        if self.findings: return "LOW"
        return "INFO"
