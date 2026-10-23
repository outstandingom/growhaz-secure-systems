"""
JSON Report Generator.

Produces a comprehensive JSON report with scan metadata, endpoint inventory,
all findings (with redacted evidence), coverage summary, and overall risk assessment.
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
        discovered_endpoints: List[Any],
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
            elif state == TestState.NOT_APPLICABLE.value:
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
                "endpoints_discovered": len(discovered_endpoints),
                "discovered_endpoints": [ep.to_dict() if hasattr(ep, 'to_dict') else ep for ep in discovered_endpoints],
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
            "findings": [self._enrich_finding(f) for f in findings],
            "coverage_summary": self._build_coverage_summary(test_results),
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

    def _enrich_finding(self, finding) -> dict:
        """Add proof_of_concept, payload_used, response_evidence, reproduction_curl to each finding."""
        d = finding.to_dict() if hasattr(finding, 'to_dict') else dict(finding)

        endpoint = d.get("endpoint", "")
        method = d.get("method", "GET")
        parameter = d.get("parameter", "")
        payload = d.get("payload", "")

        # Build reproduction curl command
        if method == "POST":
            body = f'{{{json.dumps(parameter)}: {json.dumps(payload)}}}' if parameter and payload else '{"key": "value"}'
            curl = f'curl -s -X POST "{endpoint}" -H "Content-Type: application/json" -d \'{body}\''
        elif parameter and payload:
            curl = f'curl -s "{endpoint}?{parameter}={payload}"'
        else:
            curl = f'curl -s "{endpoint}"'

        # Build proof_of_concept description
        vuln = d.get("vulnerability", d.get("title", ""))
        poc_lines = [f"# {vuln} — Proof of Concept"]
        if parameter:
            poc_lines.append(f"# Vulnerable parameter: {parameter}")
        if payload:
            poc_lines.append(f"# Payload used: {payload}")
        poc_lines.append(f"# Reproduction:")
        poc_lines.append(curl)

        # Extract response evidence from the finding's evidence list
        evidence_list = d.get("evidence", [])
        response_snippets = [
            e.get("description", "") if isinstance(e, dict) else str(e)
            for e in evidence_list[:3]
        ]

        d["proof_of_concept"] = "\n".join(poc_lines)
        d["payload_used"] = payload or (evidence_list[0].get("description", "") if evidence_list and isinstance(evidence_list[0], dict) else "")
        d["response_evidence"] = response_snippets
        d["reproduction_curl"] = curl

        return d

    def _build_coverage_summary(self, test_results: dict) -> dict:
        """Build a coverage summary showing which tests ran, were blocked, or not tested."""
        coverage = {
            "total_tests": len(test_results),
            "fully_tested": 0,
            "not_tested": 0,
            "blocked": 0,
            "errored": 0,
            "inconclusive": 0,
            "not_tested_tests": [],
            "note": "",
        }
        for test_name, result in test_results.items():
            state = result.get("state", "")
            if state in ("NOT_TESTED", "NOT_APPLICABLE", "NOT_IMPLEMENTED"):
                coverage["not_tested"] += 1
                coverage["not_tested_tests"].append({
                    "test": test_name,
                    "state": state,
                    "reason": result.get("details", ""),
                })
            elif state == "BLOCKED":
                coverage["blocked"] += 1
            elif state == "ERROR":
                coverage["errored"] += 1
            elif state == "INCONCLUSIVE":
                coverage["inconclusive"] += 1
            else:
                coverage["fully_tested"] += 1

        not_tested = coverage["not_tested"]
        total = coverage["total_tests"]
        if not_tested > 0:
            coverage["note"] = (
                f"{not_tested}/{total} tests could not run (no injectable parameters found). "
                "Re-run with --js flag to enable JavaScript/SPA crawling for better coverage."
            )
        return coverage
