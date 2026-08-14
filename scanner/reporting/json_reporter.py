"""
JSON Report Generator.

Produces a comprehensive JSON report with scan metadata, endpoint inventory,
all findings (with redacted evidence), and overall risk assessment.
"""

import json
import datetime
from typing import Any, Dict, List, Optional

from ..models.finding import StandardFinding
from ..models.test_state import TestState


class JSONReporter:
    """Generates structured JSON reports."""

    def generate(
        self,
        base_url: str,
        test_run_id: str,
        start_time: str,
        end_time: str,
        endpoints_discovered: int,
        endpoints_tested: int,
        findings: List[StandardFinding],
        test_results: Dict[str, dict],
        risk_level: str,
        risk_score: float,
        engine_stats: dict,
        auth_summary: dict,
        output_path: str = "security_report.json",
    ) -> dict:
        """Generate and save a JSON report.

        Returns the report dict.
        """
        # Categorize test results
        tests_executed = []
        tests_not_executed = []
        tests_blocked = []
        tests_errored = []
        tests_inconclusive = []

        for test_name, result in test_results.items():
            state = result.get("state", "NOT_TESTED")
            entry = {"test": test_name, "state": state, "details": result.get("details", "")}

            if state == TestState.NOT_TESTED.value or state == TestState.NOT_IMPLEMENTED.value:
                tests_not_executed.append(entry)
            elif state == TestState.BLOCKED.value:
                tests_blocked.append(entry)
            elif state == TestState.ERROR.value:
                tests_errored.append(entry)
            elif state == TestState.INCONCLUSIVE.value:
                tests_inconclusive.append(entry)
            else:
                tests_executed.append(entry)

        # Determine scan status
        total_tests = len(test_results)
        failed_or_blocked = len(tests_blocked) + len(tests_errored)
        scan_status = "completed"
        if failed_or_blocked > total_tests * 0.3:
            scan_status = "incomplete"
        elif failed_or_blocked > 0:
            scan_status = "completed_with_issues"

        # Build vulnerability summary
        vuln_by_severity = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in findings:
            sev = f.severity.upper()
            if sev in vuln_by_severity:
                vuln_by_severity[sev] += 1

        report = {
            "scanner": "GROWHAZ Security Testing Tool",
            "version": "5.0.0",
            "scan_metadata": {
                "target": base_url,
                "test_run_id": test_run_id,
                "start_time": start_time,
                "end_time": end_time,
                "scan_status": scan_status,
                "endpoints_discovered": endpoints_discovered,
                "endpoints_tested": endpoints_tested,
            },
            "risk_assessment": {
                "overall_risk": risk_level,
                "risk_score": round(risk_score, 2),
                "vulnerability_counts": vuln_by_severity,
                "total_findings": len(findings),
            },
            "test_summary": {
                "total_tests": total_tests,
                "executed": len(tests_executed),
                "not_executed": len(tests_not_executed),
                "blocked": len(tests_blocked),
                "errored": len(tests_errored),
                "inconclusive": len(tests_inconclusive),
                "tests": test_results,
            },
            "findings": [f.to_dict() for f in findings],
            "blocked_tests": tests_blocked,
            "errors": tests_errored,
            "inconclusive_tests": tests_inconclusive,
            "engine_stats": engine_stats,
            "authentication": auth_summary,
        }

        # Save
        try:
            with open(output_path, "w") as f:
                json.dump(report, f, indent=2, default=str)
        except Exception as e:
            report["_save_error"] = str(e)

        return report
