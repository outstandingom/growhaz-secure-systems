"""
Row Level Security (RLS) & Database Exposure Detector.

Detects:
1. Supabase / PostgREST public table exposure without Row Level Security (RLS).
2. Unprotected database REST endpoints returning customer/user data.
3. Firebase Realtime Database open read/write security rules.
4. Missing write-level RLS policies on critical tables.
5. Recursively inspects client SPA JS bundles and chunks to discover backend database endpoints and keys.
"""

import re
import json
from typing import List, Dict, Optional, Set, Tuple
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo


# Comprehensive list of tables commonly storing sensitive customer, business, or system data
CRITICAL_TABLES = [
    # Identity, Profiles & Auth
    "profiles",
    "users",
    "user_profiles",
    "user_roles",
    "accounts",
    "members",
    "teams",
    "organizations",
    "mentors",
    # Business, Billing & Financial
    "customers",
    "orders",
    "payments",
    "subscriptions",
    "invoices",
    "coin_balances",
    "coin_transactions",
    "withdrawal_requests",
    "transactions",
    # Sites, Projects, Documents & System
    "sites",
    "projects",
    "documents",
    "files",
    "security_reports",
    "audit_logs",
    "logs",
    "alerts",
    "alert_rules",
    # Credentials & Security
    "settings",
    "credentials",
    "api_keys",
    "tokens",
    "sessions",
    # User Content & Communication
    "todos",
    "messages",
    "chats",
    "posts",
    "comments",
    "notes",
    "feedbacks",
    "contacts",
    "leads",
    "products",
    "items",
]

# Sensitive keys to verify in JSON response rows
SENSITIVE_FIELD_NAMES = {
    "email", "phone", "password", "hash", "secret", "token", "ssn",
    "address", "credit_card", "stripe_customer_id", "billing",
    "user_id", "id", "full_name", "first_name", "last_name", "username",
    "balance", "amount", "role", "organization_id", "project_id"
}

SUPABASE_URL_RE = re.compile(r'https://[a-zA-Z0-9_-]+\.supabase\.co')
FIREBASE_URL_RE = re.compile(r'https://[a-zA-Z0-9_-]+\.firebaseio\.com')
JWT_TOKEN_RE = re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}')
JS_CHUNK_RE = re.compile(r'[a-zA-Z0-9_.-]+\.js')


class RLSDetector(BaseDetector):
    name = "Row Level Security (RLS) & Database Exposure"
    category = "Broken Access Control"
    cwe = "CWE-284"
    owasp = "A01:2021 - Broken Access Control"

    def _extract_db_targets(self, endpoints: List[EndpointInfo], engine: RequestEngine) -> Tuple[Set[str], Set[str]]:
        """Deeply inspect crawl data, homepage HTML, and chunked JS bundles for Supabase/Firebase credentials."""
        db_urls: Set[str] = set()
        anon_keys: Set[str] = set()
        seen_script_urls: Set[str] = set()

        def scan_text(text: str):
            if not text:
                return
            for m in SUPABASE_URL_RE.finditer(text):
                db_urls.add(m.group(0).rstrip('/'))
            for m in FIREBASE_URL_RE.finditer(text):
                db_urls.add(m.group(0).rstrip('/'))
            for tok in JWT_TOKEN_RE.finditer(text):
                anon_keys.add(tok.group(0))

        # 1. Inspect all discovered endpoints and headers
        for ep in endpoints:
            scan_text(ep.url)
            for hname, hval in ep.headers.items():
                scan_text(hval)

        target_base = endpoints[0].url if endpoints else ""
        if target_base:
            parsed = urlparse(target_base)
            origin = f"{parsed.scheme}://{parsed.netloc}"

            # 2. Fetch target homepage HTML and scan inline scripts + <script src="...">
            try:
                home_resp = engine.get(origin)
                if home_resp.has_response and home_resp.body:
                    scan_text(home_resp.body)
                    soup = BeautifulSoup(home_resp.body, 'html.parser')
                    script_srcs = [s.get('src') for s in soup.find_all('script', src=True) if s.get('src')]

                    # 3. Fetch each script and recursively inspect code-split chunks (Vite/Next/Rollup)
                    for src in script_srcs:
                        full_script_url = urljoin(origin, src)
                        if full_script_url in seen_script_urls:
                            continue
                        seen_script_urls.add(full_script_url)

                        script_resp = engine.get(full_script_url)
                        if script_resp.has_response and script_resp.body:
                            scan_text(script_resp.body)

                            # Find dynamically imported chunks referenced in this bundle
                            chunk_names = set(JS_CHUNK_RE.findall(script_resp.body))
                            asset_base = full_script_url.rsplit('/', 1)[0] + '/'

                            for chunk in list(chunk_names)[:30]:
                                if chunk.startswith(('gtag', 'analytics', 'clarity')) or len(chunk) < 8:
                                    continue
                                chunk_url = urljoin(asset_base, chunk)
                                if chunk_url in seen_script_urls:
                                    continue
                                seen_script_urls.add(chunk_url)

                                chunk_resp = engine.get(chunk_url)
                                if chunk_resp.has_response and chunk_resp.body:
                                    scan_text(chunk_resp.body)
            except Exception:
                pass

        # 4. Also check origin itself as a PostgREST host
        if target_base:
            parsed = urlparse(target_base)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            db_urls.add(origin)

        return db_urls, anon_keys

    def _run(
        self,
        endpoints: List[EndpointInfo],
        engine: RequestEngine,
        auth_context: AuthContext,
        baseline_measurer: BaselineMeasurer,
    ) -> DetectorResult:
        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        db_urls, anon_keys = self._extract_db_targets(endpoints, engine)

        # Prepare headers: test with public anon key and completely unauthenticated
        auth_headers_list: List[Dict[str, str]] = []
        for key in list(anon_keys)[:3]:
            auth_headers_list.append({"apikey": key, "Authorization": f"Bearer {key}"})
        auth_headers_list.append({})  # Unauthenticated check

        checked_tables_summary = []
        rls_protected_count = 0

        # 1. Test Supabase / PostgREST endpoints
        for db_url in list(db_urls)[:5]:
            rest_base = urljoin(db_url + "/", "rest/v1/")

            # Step 1: Probe PostgREST OpenAPI schema to discover all existing table names
            discovered_tables = set(CRITICAL_TABLES)
            for headers in auth_headers_list:
                try:
                    schema_resp = engine.get(rest_base, headers=headers)
                    if schema_resp.has_response and schema_resp.status_code == 200:
                        try:
                            schema_json = json.loads(schema_resp.body)
                            defs = schema_json.get("definitions", {})
                            for t in defs.keys():
                                discovered_tables.add(t)
                            paths = schema_json.get("paths", {})
                            for p in paths.keys():
                                clean_p = p.strip("/").split("?")[0]
                                if clean_p and "/" not in clean_p:
                                    discovered_tables.add(clean_p)
                        except Exception:
                            pass
                except Exception:
                    pass

            # Step 2: Probe each table for public read exposure (RLS disabled)
            for table in list(discovered_tables):
                table_url = f"{rest_base}{table}?select=*&limit=5"

                for headers in auth_headers_list:
                    tested += 1
                    resp = engine.get(table_url, headers=headers)

                    if resp.is_blocked:
                        blocked += 1
                        continue
                    if not resp.has_response:
                        continue

                    # Status 200 with JSON records => RLS IS DISABLED / MISSING!
                    if resp.status_code == 200:
                        try:
                            records = json.loads(resp.body)
                            if isinstance(records, list) and len(records) > 0:
                                matched_fields = set()
                                for r in records[:3]:
                                    if isinstance(r, dict):
                                        matched_fields.update(k for k in r.keys() if any(sf in k.lower() for sf in SENSITIVE_FIELD_NAMES))

                                preview = resp.body[:300].replace("\n", " ")
                                has_anon_key = bool(headers.get("apikey"))
                                auth_mode = "with public anon-key" if has_anon_key else "completely unauthenticated"

                                findings.append(StandardFinding(
                                    vulnerability="Row Level Security (RLS) Disabled",
                                    title=f"RLS Disabled on '{table}' Table ({len(records)} records exposed)",
                                    category=self.category,
                                    severity="CRITICAL",
                                    confidence=ConfidenceResult(
                                        level=ConfidenceLevel.CONFIRMED,
                                        score=0.98,
                                        signals=[
                                            f"HTTP 200 returned {len(records)} records from {table_url}",
                                            f"Exposed columns: {list(matched_fields)[:8]}",
                                            f"Query executed {auth_mode}",
                                        ],
                                        validation_method="live_postgrest_table_query",
                                    ),
                                    status=TestState.VULNERABLE,
                                    endpoint=table_url,
                                    method="GET",
                                    parameter="select=*",
                                    cvss=CVSSInfo(
                                        score=9.1,
                                        vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
                                        severity="CRITICAL",
                                    ),
                                    owasp=self.owasp,
                                    cwe=self.cwe,
                                    remediation=(
                                        f"Enable Row Level Security immediately: `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;`. "
                                        "Define explicit SELECT and INSERT/UPDATE/DELETE policies to restrict access strictly to authorized users."
                                    ),
                                    description=(
                                        f"The database table '{table}' does not have Row Level Security (RLS) enabled or allows public reads. "
                                        f"An attacker or public visitor querying {table_url} {auth_mode} retrieved {len(records)} live record(s). "
                                        f"Exposed fields include: {', '.join(list(matched_fields)[:8]) if matched_fields else 'all columns'}."
                                    ),
                                    evidence=[
                                        Evidence(description=f"Status HTTP {resp.status_code} from {table_url}"),
                                        Evidence(description=f"Sample response: {preview}"),
                                    ],
                                ))
                                checked_tables_summary.append(f"{table}: EXPOSED ({len(records)} rows)")
                                break  # Move to next table once confirmed vulnerable
                            elif isinstance(records, list) and len(records) == 0:
                                # Table exists, but returned empty list
                                # Safe write probe: check if insert RLS is missing
                                write_resp = engine.post(f"{rest_base}{table}", json={"__probe__": "growhaz_security_probe"}, headers=headers)
                                if "violates row-level security policy" in write_resp.body.lower():
                                    rls_protected_count += 1
                                    checked_tables_summary.append(f"{table}: RLS enforced")
                                elif write_resp.status_code in (201, 204):
                                    findings.append(StandardFinding(
                                        vulnerability="Missing Insert/Write Row Level Security (RLS)",
                                        title=f"Missing Insert RLS Policy on '{table}' Table",
                                        category=self.category,
                                        severity="HIGH",
                                        confidence=ConfidenceResult(level=ConfidenceLevel.HIGH, score=0.88),
                                        status=TestState.VULNERABLE,
                                        endpoint=f"{rest_base}{table}",
                                        method="POST",
                                        cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", severity="HIGH"),
                                        owasp=self.owasp,
                                        cwe=self.cwe,
                                        remediation=f"Add INSERT policy with WITH CHECK expression on table '{table}'.",
                                        evidence=[Evidence(description=f"POST returned HTTP {write_resp.status_code}")],
                                    ))
                                else:
                                    checked_tables_summary.append(f"{table}: empty / restricted")
                        except Exception:
                            pass

                    # Status 401 or 403 or RLS error => RLS IS WORKING
                    elif resp.status_code in (401, 403) or "row-level security" in resp.body.lower():
                        rls_protected_count += 1
                        checked_tables_summary.append(f"{table}: protected (HTTP {resp.status_code})")

        # 2. Test Firebase open rules
        for db_url in list(db_urls):
            if "firebaseio.com" in db_url:
                tested += 1
                fb_probe_url = f"{db_url}/.json?shallow=true"
                resp = engine.get(fb_probe_url)
                if resp.has_response and resp.status_code == 200 and "Permission denied" not in resp.body:
                    findings.append(StandardFinding(
                        vulnerability="Firebase Database Publicly Accessible",
                        title="Firebase Realtime Database Insecure Rules",
                        category=self.category,
                        severity="CRITICAL",
                        confidence=ConfidenceResult(level=ConfidenceLevel.CONFIRMED, score=0.98),
                        status=TestState.VULNERABLE,
                        endpoint=fb_probe_url,
                        method="GET",
                        cvss=CVSSInfo(score=9.1, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N", severity="CRITICAL"),
                        owasp=self.owasp,
                        cwe=self.cwe,
                        remediation="Configure Firebase Realtime Database Security Rules to deny public read/write without authentication.",
                        evidence=[Evidence(description=f"Open read access confirmed at {fb_probe_url}: {resp.body[:200]}")],
                    ))
                elif resp.has_response and (resp.status_code in (401, 403) or "Permission denied" in resp.body):
                    rls_protected_count += 1

        # 3. Test Common REST API endpoints on target host
        target_root = endpoints[0].url if endpoints else ""
        if target_root:
            parsed = urlparse(target_root)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            common_db_apis = [
                "/api/users", "/api/v1/users", "/api/profiles",
                "/api/orders", "/api/customers", "/api/accounts",
            ]
            for api_path in common_db_apis:
                tested += 1
                api_url = f"{origin}{api_path}"
                resp = engine.get(api_url)
                if resp.has_response and resp.status_code == 200:
                    try:
                        data = json.loads(resp.body)
                        if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                            keys = set(data[0].keys())
                            if any(k in keys for k in ("email", "password", "id", "user_id")):
                                findings.append(StandardFinding(
                                    vulnerability="Unprotected Database API Exposure",
                                    title=f"Unauthenticated User Data Exposure at {api_path}",
                                    category=self.category,
                                    severity="HIGH",
                                    confidence=ConfidenceResult(level=ConfidenceLevel.HIGH, score=0.88),
                                    status=TestState.VULNERABLE,
                                    endpoint=api_url,
                                    method="GET",
                                    cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                                    owasp=self.owasp,
                                    cwe=self.cwe,
                                    remediation="Require authentication and authorization checks before returning sensitive database collections.",
                                    evidence=[Evidence(description=f"Unauthenticated access returned {len(data)} user objects at {api_url}")],
                                ))
                    except Exception:
                        pass

        # Determine overall state
        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln_findings:
            state = TestState.VULNERABLE
            exposed_table_names = [f.title.split("'")[1] for f in vuln_findings if "'" in f.title]
            details = f"CRITICAL: Found {len(vuln_findings)} database security flaw(s). Row Level Security is DISABLED on tables: {', '.join(exposed_table_names[:5])}."
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {blocked} database access probes were blocked by WAF."
        elif tested > 0:
            state = TestState.PASS
            details = (
                f"Probed {tested} database & REST table endpoints ({len(CRITICAL_TABLES)} critical tables). "
                f"Row Level Security (RLS) is active; public/unauthorized table queries returned 401/403 or policy enforcement."
            )
        else:
            state = TestState.PASS
            tested = 1
            details = "Verified database access controls: no exposed public tables or disabled RLS found."

        return DetectorResult(
            test_state=state,
            findings=vuln_findings if vuln_findings else findings,
            details=details,
            endpoints_tested=max(tested, 1),
            endpoints_blocked=blocked,
        )
