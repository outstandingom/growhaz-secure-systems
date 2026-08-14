"""
Scanner Configuration — CLI args and environment loading.
"""

import os
import argparse
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ScanConfig:
    """All scan configuration in one place."""
    base_url: str = ""
    report_id: str = ""
    test_run_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    test_email: str = ""
    test_password: str = ""
    test_email_b: str = ""
    test_password_b: str = ""
    openapi_spec: Optional[str] = None
    use_js: bool = False
    login_url: Optional[str] = None
    rate_limit: float = 5.0
    timeout: float = 10.0
    max_pages: int = 50
    dry_run: bool = False
    verbose: bool = False
    output_json: str = "security_report.json"
    output_md: str = "security_report.md"

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""


def parse_args() -> ScanConfig:
    """Parse CLI arguments and environment variables into ScanConfig."""
    parser = argparse.ArgumentParser(
        description="GROWHAZ Security Testing Tool v5.0 — Evidence-Driven DAST Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m scanner https://example.com
  python -m scanner https://example.com --report-id abc123
  python -m scanner https://example.com test@example.com --js
  python -m scanner https://example.com --openapi openapi.json --rate-limit 10
  python -m scanner https://example.com --dry-run
        """,
    )

    parser.add_argument("base_url", help="Base URL of the target (e.g., https://example.com)")
    parser.add_argument("test_email", nargs="?", default="", help="Test email for login (optional)")
    parser.add_argument("openapi_spec", nargs="?", default=None, help="Path to OpenAPI/Swagger JSON (optional)")
    parser.add_argument("--js", action="store_true", help="Enable JavaScript crawling with Playwright")
    parser.add_argument("--report-id", default="", help="Supabase report ID to update")
    parser.add_argument("--login-url", default=None, help="Custom login endpoint URL")
    parser.add_argument("--rate-limit", type=float, default=5.0, help="Requests per second (default: 5)")
    parser.add_argument("--timeout", type=float, default=10.0, help="Default request timeout in seconds")
    parser.add_argument("--max-pages", type=int, default=50, help="Maximum pages to crawl (default: 50)")
    parser.add_argument("--dry-run", action="store_true", help="Discover endpoints without sending attack payloads")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging output")
    parser.add_argument("--output-json", default="security_report.json", help="JSON report output path")
    parser.add_argument("--output-md", default="security_report.md", help="Markdown report output path")

    args = parser.parse_args()

    # Normalize URL
    base_url = args.base_url
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    config = ScanConfig(
        base_url=base_url.rstrip("/"),
        report_id=args.report_id or os.getenv("REPORT_ID", ""),
        test_email=args.test_email or os.getenv("TEST_EMAIL", ""),
        test_password=os.getenv("TEST_PASSWORD", ""),
        test_email_b=os.getenv("TEST_EMAIL_B", ""),
        test_password_b=os.getenv("TEST_PASSWORD_B", ""),
        openapi_spec=args.openapi_spec,
        use_js=args.js,
        login_url=args.login_url or os.getenv("LOGIN_URL"),
        rate_limit=args.rate_limit,
        timeout=args.timeout,
        max_pages=args.max_pages,
        dry_run=args.dry_run,
        verbose=args.verbose,
        output_json=args.output_json,
        output_md=args.output_md,
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_key=os.getenv("SUPABASE_KEY", ""),
    )

    return config
