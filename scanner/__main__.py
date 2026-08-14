"""
GROWHAZ Security Testing Tool v5.0 — Entry Point.

Usage:
    python -m scanner https://example.com
    python -m scanner https://example.com --report-id abc123
    python -m scanner https://example.com test@example.com --js
    python -m scanner https://example.com --dry-run
"""

import sys


def main():
    print(r"""
    +==============================================================+
    |     GROWHAZ Security Testing Tool v5.0                       |
    |     Evidence-Driven DAST Engine                              |
    |     21 Detectors | Confidence Scoring | False-Positive Guard |
    +==============================================================+
    """)

    from .config import parse_args
    from .orchestrator import ScanOrchestrator

    config = parse_args()

    print(f"📋 Configuration:")
    print(f"  • Target URL: {config.base_url}")
    print(f"  • Report ID: {config.report_id or 'Not provided'}")
    print(f"  • Test Email: {config.test_email or 'Not provided'}")
    print(f"  • OpenAPI Spec: {config.openapi_spec or 'Not provided'}")
    print(f"  • JavaScript Crawling: {'Enabled' if config.use_js else 'Disabled'}")
    print(f"  • Rate Limit: {config.rate_limit} req/s")
    print(f"  • Dry Run: {config.dry_run}")
    print(f"  • Supabase: {'Configured' if config.supabase_url else 'Not configured'}")
    print()

    orchestrator = ScanOrchestrator(config)
    exit_code = orchestrator.run()

    if exit_code == 0:
        print("\n✅ Scan completed — no policy violations")
    elif exit_code == 1:
        print("\n❌ Scanner execution error")
    elif exit_code == 2:
        print("\n🚨 Security policy failed — HIGH/CRITICAL vulnerabilities found")
    elif exit_code == 3:
        print("\n⚠️ Scan incomplete — too many tests blocked/errored")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
