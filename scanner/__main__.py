"""
GROWHAZ Security Testing Tool v5.0 — Entry Point.

Usage:
    python -m scanner https://example.com
    python -m scanner https://example.com --report-id abc123
    python -m scanner https://example.com test@example.com --js
    python -m scanner https://example.com --dry-run
"""

import sys
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


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
    orchestrator.run()
    print("\n✅ Scan completed and report uploaded successfully")
    sys.exit(0)


if __name__ == "__main__":
    main()
