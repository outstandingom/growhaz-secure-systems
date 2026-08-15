"""
Supabase Report Upload.

Preserves existing Supabase integration from v3 with improved schema.
"""

import os
import datetime
import requests
from typing import Optional


class SupabaseReporter:
    """Uploads scan reports to Supabase."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        report_id: Optional[str] = None,
    ):
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL", "")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_KEY", "")
        self.report_id = report_id or os.getenv("REPORT_ID", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    @property
    def has_report_id(self) -> bool:
        return bool(self.report_id)

    def upload(self, report: dict, risk_level: str, log_fn=None) -> bool:
        """Upload a report to Supabase.

        Args:
            report: The full JSON report dict.
            risk_level: Overall risk level string.
            log_fn: Optional logging function(message, status).

        Returns:
            True if upload succeeded, False otherwise.
        """
        def log(msg, status="INFO"):
            if log_fn:
                log_fn(msg, status)

        if not self.is_configured:
            log("Supabase credentials not configured. Skipping upload.", "WARNING")
            return False

        if not self.has_report_id:
            log("Report ID not provided. Cannot update Supabase.", "WARNING")
            return False

        endpoint = f"{self.supabase_url}/rest/v1/security_reports?id=eq.{self.report_id}"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        # Map v5 report format to expected frontend format (compatible with Alphag2report & ReportViewer)
        findings = report.get("findings", [])

        # Transform v5 findings into legacy vulnerability format if needed
        vulnerabilities = []
        informational = []
        for f in findings:
            if not isinstance(f, dict):
                continue
            confidence = f.get("confidence")
            confidence_level = ""
            confidence_score = 0.0
            if isinstance(confidence, dict):
                confidence_level = str(confidence.get("level", ""))
                try:
                    confidence_score = float(confidence.get("score", 0.0))
                except (TypeError, ValueError):
                    confidence_score = 0.0

            item = {
                "vulnerability": f.get("vulnerability") or f.get("title") or "Security Finding",
                "severity": f.get("severity", "LOW").lower(),
                "cvss_score": f.get("cvss", {}).get("score", 0.0) if isinstance(f.get("cvss"), dict) else 0.0,
                "endpoint": f.get("endpoint", ""),
                "method": f.get("method", ""),
                "evidence": f.get("evidence", []),
                "cwe": f.get("cwe", ""),
                "owasp": f.get("owasp", ""),
                "remediation": f.get("remediation", ""),
                "details": f.get("description", ""),
                "confidence": confidence_level,
                "confidence_score": confidence_score,
                "status": f.get("status", ""),
            }

            # Only confirmed/likely issues count as vulnerabilities; everything
            # else is surfaced separately so the headline count stays accurate.
            status = str(item["status"]).upper()
            if status in ("", "VULNERABLE") and confidence_level.upper() != "LOW":
                vulnerabilities.append(item)
            else:
                informational.append(item)

        # Build legacy-compatible test_summary dictionary
        v5_test_results = report.get("test_summary", {}).get("tests", {})
        legacy_test_summary = {}
        for name, info in v5_test_results.items():
            if isinstance(info, dict):
                legacy_test_summary[name] = {
                    "status": info.get("state", "UNKNOWN"),
                    "details": info.get("details", "")
                }

        scan_quality = report.get("scan_metadata", {}).get("scan_status", "completed")

        legacy_report = {
            "base_url": report.get("scan_metadata", {}).get("target", ""),
            "test_run_id": report.get("scan_metadata", {}).get("test_run_id", self.report_id),
            "timestamp": report.get("scan_metadata", {}).get("start_time", datetime.datetime.now().isoformat()),
            "vulnerabilities": vulnerabilities,
            "informational": informational,
            "test_summary": legacy_test_summary,
            "summary": {
                "total_vulnerabilities": len(vulnerabilities),
                "informational_findings": len(informational),
                "risk_level": risk_level.lower(),
                "scan_completed": True,
                "scan_quality": scan_quality,
                "blocked_tests": len(report.get("blocked_tests", []))
            },
            # Keep full v5 report embedded for future expandability
            "v5_raw_report": report
        }

        vuln_count = len(vulnerabilities)

        data = {
            "report_data": legacy_report,
            # The dashboard only renders reports whose status is exactly
            # "completed" — quality detail lives in report_data.summary.
            "report_status": "completed",
            "vulnerabilities_found": vuln_count,
            "risk_level": risk_level.lower(),
            "scanned_at": datetime.datetime.now().isoformat(),
        }


        try:
            log(f"Uploading report to Supabase (ID: {self.report_id})...")
            resp = requests.patch(endpoint, headers=headers, json=data, timeout=30)

            if resp.status_code in [200, 204]:
                log(f"Report uploaded successfully. Vulnerabilities: {vuln_count}, Risk: {risk_level}")
                return True
            else:
                log(f"Failed to upload to Supabase: HTTP {resp.status_code}", "ERROR")
                log(f"Response: {resp.text[:200]}", "ERROR")
                return False

        except Exception as e:
            log(f"Error uploading to Supabase: {e}", "ERROR")
            return False
