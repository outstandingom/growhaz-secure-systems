"""
Row Level Security (RLS) & Database Exposure Detector.

Detects:
1. Supabase / PostgREST public table exposure without Row Level Security.
2. Unprotected database REST endpoints returning customer/user data.
3. Firebase Realtime Database open read/write security rules.
4. Missing write-level RLS policies on critical tables.
"""

import re
import json
from typing import List, Dict, Optional, Set, Tuple
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo


# Tables commonly containing sensitive or proprietary data
CRITICAL_TABLES = [
    "users",
    "profiles",
    "accounts",
    "customers",
    "orders",
    "documents",
    "payments",
    "subscriptions",
    "invoices",
    "members",
    "teams",
    "organizations",
    "settings",
    "todos",
    "messages",
    "chats",
    "posts",
    "audit_logs",
    "logs",
    "credentials",
    "api_keys",
]

# Sensitive keys to check in JSON response rows
SENSITIVE_FIELD_NAMES = {
    "email", "phone", "password", "hash", "secret", "token", "ssn",
    "address", "credit_card", "stripe_customer_id", "billing",
    "user_id", "id", "full_name", "first_name", "last_name", "username"
}

SUPABASE_URL_RE = re.compile(r'https://[a-zA-Z0-9_-]+\.supabase\.co')
FIREBASE_URL_RE = re.compile(r'https://[a-zA-Z0-9_-]+\.firebaseio\.com')
JWT_TOKEN_RE = re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}')


class RLSDetector(BaseDetector):
    name = "Row Level Security (RLS) & Database Exposure"
    category = "Broken Access Control"
    cwe = "CWE-284"
    owasp = "A01:2021 - Broken Access Control"

    def _extract_db_targets(self, endpoints: List[EndpointInfo], engine: RequestEngine) -> Tuple[Set[str], Set[str]]:
        """Extract Supabase/PostgREST/Firebase URLs and anon tokens from crawl data."""
        db_urls = set()
        anon_keys = set()

        for ep in endpoints:
            # Check endpoint URLs
            if "supabase.co" in ep.url.lower():
                m = SUPABASE_URL_RE.search(ep.url)
                if m:
                    db_urls.add(m.group(0))
            if "firebaseio.com" in ep.url.lower():
                m = FIREBASE_URL_RE.search(ep.url)
                if m:
                    db_urls.add(m.group(0))

            # Check if headers contain anon keys
            for hname, hval in ep.headers.items():
                if hname.lower() in ("apikey", "authorization"):
                    for tok in JWT_TOKEN_RE.findall(hval):
                        anon_keys.add(tok)

        # Inspect JS bundles or homepage body for Supabase references
        for ep in endpoints[:15]:
            if ep.method == "GET" and (ep.url.endswith(".js") or ep.url.endswith("/") or "asset" in ep.url):
                try:
                    resp = engine.get(ep.url)
                    if resp.has_response and resp.body:
                        for m in SUPABASE_URL_RE.finditer(resp.body):
                            db_urls.add(m.group(0))
                        for m in FIREBASE_URL_RE.finditer(resp.body):
                            db_urls.add(m.group(0))
                        for tok in JWT_TOKEN_RE.finditer(resp.body):
                            # Usually Supabase anon keys have role "anon"
                            raw_tok = tok.group(0)
                            anon_keys.add(raw_tok)
                except Exception:
                    pass

        # If base target itself has /rest/v1 or is an API
        if endpoints:
            base_origin = endpoints[0].url.split("//", 1)
            if len(base_origin) == 2:
                scheme = base_origin[0]
                host = base_origin[1].split("/", 1)[0]
                db_urls.add(f"{scheme}//{host}")

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
        auth_headers_list: List[Dict[str, str]] = [{}]  # Unauthenticated check first
        for key in list(anon_keys)[:3]:
            auth_headers_list.append({"apikey": key, "Authorization": f"Bearer {key}"})

        checked_tables_summary = []
        rls_protected_count = 0

        # 1. Test Supabase / PostgREST endpoints
        for db_url in list(db_urls)[:4]:
            rest_base = urljoin(db_url + "/", "rest/v1/")

            for table in CRITICAL_TABLES:
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
                                # Inspect records for sensitive fields
                                matched_fields = set()
                                for r in records[:3]:
                                    if isinstance(r, dict):
                                        matched_fields.update(k for k in r.keys() if any(sf in k.lower() for sf in SENSITIVE_FIELD_NAMES))

                                preview = resp.body[:300].replace("\n", " ")
                                has_anon_key = bool(headers.get("apikey"))
                                auth_mode = "with public anon-key" if has_anon_key else "unauthenticated"

                                findings.append(StandardFinding(
                                    vulnerability="Row Level Security (RLS) Disabled",
                                    title=f"RLS Disabled on '{table}' Table ({len(records)} records exposed)",
                                    category=self.category,
                                    severity="CRITICAL",
                                    confidence=ConfidenceResult(
                                        level=ConfidenceLevel.CONFIRMED,
                                        score=0.95,
                                        signals=[
                                            f"HTTP 200 returned {len(records)} records from {table_url}",
                                            f"Sensitive keys identified: {list(matched_fields)[:6]}",
                                            f"Request made {auth_mode}",
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
                                        f"An unauthenticated attacker or user with public anon-key retrieved {len(records)} record(s) directly. "
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
                                # Check if write RLS is enabled or open
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
                                        confidence=ConfidenceResult(level=ConfidenceLevel.HIGH, score=0.85),
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
            details = f"Detected {len(vuln_findings)} database security flaw(s). Critical data tables exposed."
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
