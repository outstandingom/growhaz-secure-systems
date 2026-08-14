"""
Markdown Report Generator.

Human-readable report for GitHub Actions and developer review.
Does NOT claim 'Scan completed successfully' if significant tests failed or were blocked.
"""

import json
from typing import Dict, List

from ..models.finding import StandardFinding
from ..models.test_state import TestState


STATE_EMOJI = {
    "PASS": "✅",
    "VULNERABLE": "❌",
    "BLOCKED": "🚧",
    "ERROR": "⚠️",
    "INCONCLUSIVE": "🔶",
    "NOT_TESTED": "⬜",
    "NOT_APPLICABLE": "➖",
    "NOT_IMPLEMENTED": "🔲",
}


class MarkdownReporter:
    """Generates markdown reports for GitHub Actions."""

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
        scan_status: str,
        output_path: str = "security_report.md",
    ) -> str:
        """Generate and save a markdown report."""
        lines = []
        lines.append("# 🔐 GROWHAZ Security Test Report v5\n")
        lines.append(f"**Target URL:** {base_url}\n")
        lines.append(f"**Scan Start:** {start_time}  ")
        lines.append(f"**Scan End:** {end_time}\n")
        lines.append(f"**Test Run ID:** `{test_run_id}`\n")

        # Scan status banner
        if scan_status == "incomplete":
            lines.append("> ⚠️ **SCAN INCOMPLETE** — More than 30% of tests were blocked or errored. Results may not be reliable.\n")
        elif scan_status == "completed_with_issues":
            lines.append("> 🔶 **SCAN COMPLETED WITH ISSUES** — Some tests were blocked or errored.\n")

        # Summary
        lines.append("## 📊 Summary\n")
        vuln_count = sum(1 for f in findings if f.status == TestState.VULNERABLE)
        lines.append(f"- **Overall Risk:** {risk_level.upper()} (score: {risk_score:.1f})")
        lines.append(f"- **Vulnerabilities Found:** {vuln_count}")
        lines.append(f"- **Endpoints Discovered:** {endpoints_discovered}")
        lines.append(f"- **Endpoints Tested:** {endpoints_tested}\n")

        # Severity breakdown
        sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in findings:
            s = f.severity.upper()
            if s in sev_counts:
                sev_counts[s] += 1

        if vuln_count > 0:
            lines.append("### Severity Breakdown\n")
            lines.append("| Severity | Count |")
            lines.append("|----------|-------|")
            for sev, count in sev_counts.items():
                if count > 0:
                    lines.append(f"| {sev} | {count} |")
            lines.append("")

        # Test results table
        lines.append("## 🧪 Test Results\n")
        lines.append("| Test | Status | Confidence | Details |")
        lines.append("|------|--------|------------|---------|")

        for test_name, result in test_results.items():
            state = result.get("state", "NOT_TESTED")
            emoji = STATE_EMOJI.get(state, "❓")
            details = result.get("details", "")[:80]
            confidence = result.get("confidence", "")
            lines.append(f"| {test_name} | {emoji} {state} | {confidence} | {details} |")

        lines.append("")

        # Findings
        if findings:
            lines.append("## 🚨 Findings\n")
            for i, finding in enumerate(findings, 1):
                conf = finding.confidence
                lines.append(f"### {i}. {finding.vulnerability}")
                lines.append("")
                lines.append("| Field | Value |")
                lines.append("|-------|-------|")
                lines.append(f"| **Severity** | {finding.severity} |")
                lines.append(f"| **Confidence** | {conf.level.value} ({conf.score:.0%}) |")
                lines.append(f"| **Status** | {finding.status.value} |")
                lines.append(f"| **Endpoint** | `{finding.endpoint}` |")
                if finding.method:
                    lines.append(f"| **Method** | {finding.method} |")
                if finding.parameter:
                    lines.append(f"| **Parameter** | `{finding.parameter}` |")
                if finding.payload:
                    lines.append(f"| **Payload** | `{finding.payload[:80]}` |")
                lines.append(f"| **CVSS** | {finding.cvss.score} ({finding.cvss.severity}) |")
                lines.append(f"| **OWASP** | {finding.owasp} |")
                lines.append(f"| **CWE** | {finding.cwe} |")
                if finding.remediation:
                    lines.append(f"| **Remediation** | {finding.remediation[:120]} |")
                lines.append("")

                # Evidence summary
                if finding.evidence:
                    lines.append(f"<details><summary>Evidence ({len(finding.evidence)} items)</summary>\n")
                    for ev in finding.evidence[:3]:  # Limit to 3 evidence items in markdown
                        lines.append(f"- {ev.description}")
                        if ev.response and ev.response.status_code:
                            lines.append(f"  - Status: {ev.response.status_code}")
                    lines.append("\n</details>\n")
        else:
            lines.append("## ✅ No Vulnerabilities Found\n")
            if scan_status == "completed":
                lines.append("No security issues were detected during this scan.\n")
            else:
                lines.append("No vulnerabilities detected, but some tests could not complete. See test results above.\n")

        # Footer
        lines.append("---")
        lines.append(f"*Report generated by GROWHAZ Security Testing Tool v5.0 | {scan_status}*")

        content = "\n".join(lines)

        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass

        return content
