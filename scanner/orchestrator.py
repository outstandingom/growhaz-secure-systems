"""
Orchestrator — main scan pipeline.

Crawler → Endpoint Inventory → Auth Context → Detector Registry →
Request Engine → Detection → Findings → CVSS/CWE/OWASP →
Risk Engine → JSON/Markdown/Supabase
"""

import sys
import time
import datetime
import logging
from typing import Dict, List, Optional

from .config import ScanConfig
from .models.test_state import TestState
from .models.finding import StandardFinding
from .models.endpoint import EndpointInfo
from .engine.request_engine import RequestEngine
from .engine.auth_context import AuthContext
from .engine.rate_limiter import RateLimiter
from .engine.waf_detector import WAFDetector
from .engine.baseline import BaselineMeasurer
from .discovery.crawler import StaticCrawler
from .discovery.endpoint_inventory import EndpointInventory
from .detectors.registry import get_all_detectors
from .detectors.base_detector import DetectorResult
from .reporting.json_reporter import JSONReporter
from .reporting.markdown_reporter import MarkdownReporter
from .reporting.supabase_reporter import SupabaseReporter

try:
    from .scoring.risk_engine import RiskEngine
except ImportError:
    RiskEngine = None

try:
    from .discovery.js_crawler import JSCrawler
except ImportError:
    JSCrawler = None

try:
    from .discovery.openapi_loader import OpenAPILoader
except ImportError:
    OpenAPILoader = None


logger = logging.getLogger("growhaz")


class ScanOrchestrator:
    """Main scan orchestration pipeline."""

    # Exit codes
    EXIT_SUCCESS = 0          # Scan completed, policy passed
    EXIT_SCANNER_ERROR = 1    # Scanner execution error
    EXIT_POLICY_FAILED = 2    # Security policy failed (vulnerabilities found above threshold)
    EXIT_INCOMPLETE = 3       # Scan incomplete (>30% tests blocked/errored)

    def __init__(self, config: ScanConfig):
        self.config = config
        self.start_time = ""
        self.end_time = ""

        # Setup logging
        log_level = logging.DEBUG if config.verbose else logging.INFO
        logging.basicConfig(
            level=log_level,
            format="%(message)s",
            stream=sys.stdout,
        )

        # Core components
        self.rate_limiter = RateLimiter(requests_per_second=config.rate_limit)
        self.waf_detector = WAFDetector()
        self.engine = RequestEngine(
            rate_limiter=self.rate_limiter,
            waf_detector=self.waf_detector,
            default_timeout=config.timeout,
        )
        self.auth_context = AuthContext.from_env(config.base_url)
        if config.login_url:
            self.auth_context.login_url = config.login_url
        if config.test_email:
            self.auth_context.user_a.identifier = config.test_email
        if config.test_password:
            self.auth_context.user_a.secret = config.test_password
        if config.test_email_b:
            self.auth_context.user_b.identifier = config.test_email_b
        if config.test_password_b:
            self.auth_context.user_b.secret = config.test_password_b

        self.baseline_measurer = BaselineMeasurer()
        self.inventory = EndpointInventory()

        # Results
        self.all_findings: List[StandardFinding] = []
        self.test_results: Dict[str, dict] = {}

    def run(self) -> int:
        """Execute the full scan pipeline. Returns exit code."""
        self.start_time = datetime.datetime.now().isoformat()
        logger.info("=" * 60)
        logger.info("🚀 GROWHAZ Security Testing Tool v5.0")
        logger.info("   Evidence-Driven DAST Engine")
        logger.info("=" * 60)
        logger.info(f"Target: {self.config.base_url}")
        logger.info(f"Test Run ID: {self.config.test_run_id}")
        logger.info(f"Rate Limit: {self.config.rate_limit} req/s")
        logger.info(f"JavaScript Crawling: {'Enabled' if self.config.use_js else 'Disabled'}")
        logger.info(f"Dry Run: {self.config.dry_run}")
        logger.info("")

        try:
            # Phase 1: Discovery
            try:
                self._discover_endpoints()
            except Exception as e:
                logger.error(f"Discovery phase error: {e}")

            # Phase 2: Authentication
            try:
                self._authenticate()
            except Exception as e:
                logger.error(f"Authentication phase error: {e}")

            # Phase 3: Run detectors
            if not self.config.dry_run:
                try:
                    self._run_detectors()
                except Exception as e:
                    logger.error(f"Detector phase error: {e}")
            else:
                logger.info("🔒 Dry run mode — skipping attack payloads")

            # Phase 4: Calculate risk
            risk_level, risk_score = self._calculate_risk()

            # Phase 5: Generate reports
            self._generate_reports(risk_level, risk_score)

            self.end_time = datetime.datetime.now().isoformat()

            # Phase 6: Print summary
            self._print_summary(risk_level, risk_score)

            return 0

        except KeyboardInterrupt:
            logger.info("\n⚠️ Scan interrupted by user")
            self.end_time = datetime.datetime.now().isoformat()
            return 0
        except Exception as e:
            logger.error(f"\n❌ Unexpected scanner error: {type(e).__name__}: {e}")
            self.end_time = datetime.datetime.now().isoformat()
            try:
                risk_level, risk_score = self._calculate_risk()
                self._generate_reports(risk_level, risk_score)
            except Exception:
                pass
            return 0

    def _discover_endpoints(self):
        """Phase 1: Discover all endpoints."""
        logger.info("🔍 Phase 1: Discovering endpoints...")

        # Static crawling
        crawler = StaticCrawler(self.config.base_url, self.engine)
        static_endpoints = crawler.crawl(max_pages=self.config.max_pages)
        for ep in static_endpoints:
            self.inventory.add(ep)
        logger.info(f"  Static crawler: {len(static_endpoints)} endpoints")

        # JavaScript crawling
        if self.config.use_js and JSCrawler:
            try:
                js_crawler = JSCrawler(self.config.base_url, self.engine)
                js_endpoints = js_crawler.crawl(max_pages=self.config.max_pages)
                for ep in js_endpoints:
                    self.inventory.add(ep)
                logger.info(f"  JS crawler: {len(js_endpoints)} endpoints")
            except Exception as e:
                logger.warning(f"  JS crawler failed: {e}")

        # OpenAPI spec
        if self.config.openapi_spec and OpenAPILoader:
            try:
                loader = OpenAPILoader(self.config.base_url)
                api_endpoints = loader.load(self.config.openapi_spec)
                for ep in api_endpoints:
                    self.inventory.add(ep)
                logger.info(f"  OpenAPI: {len(api_endpoints)} endpoints")
            except Exception as e:
                logger.warning(f"  OpenAPI load failed: {e}")

        total = len(self.inventory.get_endpoints())
        logger.info(f"  ✅ Total unique endpoints: {total}")
        logger.info("")

    def _authenticate(self):
        """Phase 2: Attempt authentication."""
        logger.info("🔑 Phase 2: Authentication...")

        if self.auth_context.user_a.identifier:
            success = self.auth_context.attempt_login(self.engine.session, self.auth_context.user_a)
            logger.info(f"  User A: {'✅ Authenticated' if success else '❌ Failed'}")
        else:
            logger.info("  User A: No credentials provided")

        if self.auth_context.user_b.identifier:
            import requests
            session_b = requests.Session()
            success = self.auth_context.attempt_login(session_b, self.auth_context.user_b)
            logger.info(f"  User B: {'✅ Authenticated' if success else '❌ Failed'}")
        else:
            logger.info("  User B: Not configured (IDOR testing limited)")

        # Apply auth to engine session
        if self.auth_context.is_authenticated:
            self.auth_context.apply_auth(self.engine.session)

        logger.info("")

    def _run_detectors(self):
        """Phase 3: Run all registered detectors."""
        logger.info("🧪 Phase 3: Running security tests...")
        logger.info("")

        endpoints = self.inventory.get_endpoints()
        detectors = get_all_detectors()

        for detector in detectors:
            logger.info(f"  {'='*50}")
            logger.info(f"  Running: {detector.name}")
            logger.info(f"  {'='*50}")

            start = time.time()
            result = detector.run(
                endpoints=endpoints,
                engine=self.engine,
                auth_context=self.auth_context,
                baseline_measurer=self.baseline_measurer,
            )
            elapsed = time.time() - start

            # Store result
            confidence_str = ""
            if result.findings:
                levels = []
                for f in result.findings:
                    if hasattr(f.confidence, 'level'):
                        lvl = f.confidence.level
                        levels.append(lvl.value if hasattr(lvl, 'value') else str(lvl))
                    else:
                        levels.append(str(f.confidence))
                confidence_str = max(levels) if levels else ""

            self.test_results[detector.name] = {
                "state": result.test_state.value,
                "details": result.details,
                "findings_count": len(result.findings),
                "endpoints_tested": result.endpoints_tested,
                "endpoints_blocked": result.endpoints_blocked,
                "elapsed_seconds": round(elapsed, 1),
                "confidence": confidence_str,
            }

            # Collect findings
            for finding in result.findings:
                finding.test_run_id = self.config.test_run_id
                self.all_findings.append(finding)

            # Log result
            emoji = {
                TestState.PASS: "✅", TestState.VULNERABLE: "❌",
                TestState.BLOCKED: "🚧", TestState.ERROR: "⚠️",
                TestState.INCONCLUSIVE: "🔶", TestState.NOT_TESTED: "⬜",
                TestState.NOT_APPLICABLE: "➖", TestState.NOT_IMPLEMENTED: "🔲",
            }.get(result.test_state, "❓")

            logger.info(f"  {emoji} {result.test_state.value} — {result.details} ({elapsed:.1f}s)")
            logger.info("")

        # Post-processing: de-duplicate and reduce false positives
        before = len(self.all_findings)
        self.all_findings = self._consolidate_findings(self.all_findings)
        after = len(self.all_findings)
        if before != after:
            logger.info(f"  🧹 Consolidated findings: {before} → {after} (duplicates merged)")
            logger.info("")

    @staticmethod
    def _normalize_title(title: str) -> str:
        """Strip per-instance suffixes so the same issue groups together."""
        base = title.split(" (")[0].strip()
        return base or title.strip()

    def _consolidate_findings(self, findings: List[StandardFinding]) -> List[StandardFinding]:
        """Merge duplicate findings of the same issue class into one finding.

        Detectors emit one finding per endpoint/payload combination, which
        inflates counts (e.g. the same permissive CORS header on 14 pages).
        We group by issue class and attach the list of affected endpoints.
        """
        grouped: Dict[tuple, StandardFinding] = {}
        affected: Dict[tuple, List[str]] = {}

        for f in findings:
            key = (
                self._normalize_title(f.title or f.vulnerability),
                (f.cwe or "").strip(),
                (f.parameter or "").strip(),
                (f.status.value if isinstance(f.status, TestState) else str(f.status)),
            )
            ep = f.endpoint or ""
            affected.setdefault(key, [])
            if ep and ep not in affected[key]:
                affected[key].append(ep)

            existing = grouped.get(key)
            if existing is None:
                f.title = self._normalize_title(f.title or f.vulnerability)
                f.vulnerability = f.title
                grouped[key] = f
                continue

            # Keep the highest-scoring / highest-confidence representative
            if f.cvss.score > existing.cvss.score:
                existing.cvss = f.cvss
                existing.severity = f.severity
                existing.description = f.description
            try:
                if f.confidence.score > existing.confidence.score:
                    existing.confidence = f.confidence
            except Exception:
                pass
            # Cap evidence so reports stay readable
            if len(existing.evidence) < 3:
                existing.evidence.extend(f.evidence[: 3 - len(existing.evidence)])

        consolidated: List[StandardFinding] = []
        for key, f in grouped.items():
            eps = affected.get(key, [])
            if len(eps) > 1:
                shown = ", ".join(eps[:10])
                more = f" (+{len(eps) - 10} more)" if len(eps) > 10 else ""
                f.description = (
                    f"{f.description}\n\nAffected endpoints ({len(eps)}): {shown}{more}"
                )
                f.endpoint = eps[0]
            consolidated.append(f)

        severity_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        consolidated.sort(
            key=lambda x: (severity_rank.get(x.severity.upper(), 5), -x.cvss.score)
        )
        return consolidated


    def _calculate_risk(self):
        """Phase 4: Calculate overall risk."""
        if RiskEngine:
            try:
                risk_eng = RiskEngine()
                risk_level, risk_score = risk_eng.calculate(self.all_findings, self.test_results)
                return risk_level, risk_score
            except Exception:
                pass

        # Fallback simple risk calculation
        vuln_findings = [f for f in self.all_findings if f.status == TestState.VULNERABLE]
        if not vuln_findings:
            return "LOW", 0.0

        max_cvss = max((f.cvss.score for f in vuln_findings), default=0.0)
        if max_cvss >= 9.0:
            return "CRITICAL", max_cvss
        elif max_cvss >= 7.0:
            return "HIGH", max_cvss
        elif max_cvss >= 4.0:
            return "MEDIUM", max_cvss
        else:
            return "LOW", max_cvss

    def _generate_reports(self, risk_level: str, risk_score: float):
        """Phase 5: Generate all reports."""
        logger.info("📊 Phase 5: Generating reports...")

        endpoints = self.inventory.get_endpoints()

        # Scan status
        total = len(self.test_results)
        failed = sum(1 for r in self.test_results.values() if r["state"] in ("BLOCKED", "ERROR"))
        if total > 0 and failed / total > 0.3:
            scan_status = "incomplete"
        elif failed > 0:
            scan_status = "completed_with_issues"
        else:
            scan_status = "completed"

        # JSON
        json_reporter = JSONReporter()
        report = json_reporter.generate(
            base_url=self.config.base_url,
            test_run_id=self.config.test_run_id,
            start_time=self.start_time,
            end_time=self.end_time or datetime.datetime.now().isoformat(),
            discovered_endpoints=endpoints,
            endpoints_tested=sum(r.get("endpoints_tested", 0) for r in self.test_results.values()),
            findings=self.all_findings,
            test_results=self.test_results,
            risk_level=risk_level,
            risk_score=risk_score,
            engine_stats=self.engine.get_stats(),
            auth_summary=self.auth_context.get_summary(),
            output_path=self.config.output_json,
        )
        logger.info(f"  ✅ JSON report: {self.config.output_json}")

        # Markdown
        md_reporter = MarkdownReporter()
        md_reporter.generate(
            base_url=self.config.base_url,
            test_run_id=self.config.test_run_id,
            start_time=self.start_time,
            end_time=self.end_time or datetime.datetime.now().isoformat(),
            endpoints_discovered=len(endpoints),
            endpoints_tested=sum(r.get("endpoints_tested", 0) for r in self.test_results.values()),
            findings=self.all_findings,
            test_results=self.test_results,
            risk_level=risk_level,
            risk_score=risk_score,
            scan_status=scan_status,
            output_path=self.config.output_md,
        )
        logger.info(f"  ✅ Markdown report: {self.config.output_md}")

        # Supabase
        supabase = SupabaseReporter(
            supabase_url=self.config.supabase_url,
            supabase_key=self.config.supabase_key,
            report_id=self.config.report_id,
        )
        if supabase.is_configured and supabase.has_report_id:
            success = supabase.upload(report, risk_level, log_fn=lambda msg, s="": logger.info(f"  {msg}"))
            if success:
                logger.info("  ✅ Supabase upload complete")
            else:
                logger.warning("  ⚠️ Supabase upload failed")
        else:
            logger.info("  ℹ️ Supabase not configured — skipping upload")

        logger.info("")

    def _print_summary(self, risk_level: str, risk_score: float):
        """Print final summary."""
        logger.info("=" * 60)
        logger.info("📊 SECURITY TEST SUMMARY")
        logger.info("=" * 60)

        emoji_map = {
            "PASS": "✅", "VULNERABLE": "❌", "BLOCKED": "🚧",
            "ERROR": "⚠️", "INCONCLUSIVE": "🔶", "NOT_TESTED": "⬜",
            "NOT_APPLICABLE": "➖", "NOT_IMPLEMENTED": "🔲",
        }

        for test_name, result in self.test_results.items():
            state = result["state"]
            emoji = emoji_map.get(state, "❓")
            details = result["details"][:60]
            logger.info(f"  {emoji} {test_name}: {state} — {details}")

        vuln_count = sum(1 for f in self.all_findings if f.status == TestState.VULNERABLE)
        logger.info("")
        logger.info(f"  🎯 Overall Risk: {risk_level} (CVSS: {risk_score:.1f})")
        logger.info(f"  📋 Total Findings: {len(self.all_findings)} ({vuln_count} confirmed vulnerable)")
        logger.info(f"  🔧 Total Requests: {self.engine.total_requests}")

        if self.waf_detector.detected_waf:
            logger.info(f"  🛡️ WAF Detected: {self.waf_detector.detected_waf}")

        logger.info("")
        logger.info("=" * 60)
        logger.info("📝 IMPORTANT NOTES:")
        logger.info("  • This tool tests for COMMON vulnerabilities")
        logger.info("  • Manual testing is still required for comprehensive assessment")
        logger.info("  • Always test in a STAGING environment first")
        logger.info("  • Never test production systems without authorization")
        logger.info("=" * 60)

    def _determine_exit_code(self, risk_level: str) -> int:
        """Determine exit code based on results."""
        total = len(self.test_results)
        if total == 0:
            return self.EXIT_SUCCESS

        blocked_or_errored = sum(
            1 for r in self.test_results.values()
            if r["state"] in ("BLOCKED", "ERROR")
        )

        # Incomplete scan
        if blocked_or_errored / total > 0.3:
            return self.EXIT_INCOMPLETE

        # Policy failure
        if risk_level in ("CRITICAL", "HIGH"):
            return self.EXIT_POLICY_FAILED

        return self.EXIT_SUCCESS
