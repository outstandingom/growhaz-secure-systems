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

        # Build upload data
        findings = report.get("findings", [])
        vuln_count = len(findings)

        data = {
            "report_data": report,
            "report_status": report.get("scan_metadata", {}).get("scan_status", "completed"),
            "vulnerabilities_found": vuln_count,
            "risk_level": risk_level,
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
