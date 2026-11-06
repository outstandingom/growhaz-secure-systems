"""
SQL Injection Detector — evidence-driven, false-positive-resistant.

Detection approach:
1. Baseline capture with valid parameters and auth headers
2. Boolean-based: response SIMILARITY and data differential comparison
3. Time-based: statistical analysis (median + stddev)
4. Error-based: database and PostgREST syntax error signatures
5. REST / BaaS parameter and filter injection (preserving valid default params & headers)
"""

from typing import List
import re
import time
from urllib.parse import urlparse, urljoin

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, ResponseEvidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine, RequestResult
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer, BaselineProfile
from ..models.endpoint import EndpointInfo


DB_ERROR_SIGS = {
    "postgresql": [
        r"pg_query", r"pg_exec", r"postgresql.*error",
        r"unterminated quoted string", r"invalid input syntax for",
        r"current transaction is aborted", r"syntax error at or near",
        r"operator does not exist", r"PGRST\d{3}", r"column .* does not exist",
    ],
    "mysql": [
        r"you have an error in your sql syntax",
        r"mysql_fetch", r"mysql_num_rows", r"mysql_query",
        r"warning.*mysql", r"unclosed quotation mark",
        r"supplied argument is not a valid mysql",
    ],
    "mssql": [
        r"microsoft sql server", r"unclosed quotation mark after",
        r"mssql_query", r"odbc sql server driver",
        r"sql server.*error", r"incorrect syntax near",
    ],
    "oracle": [
        r"ora-\d{5}", r"oracle.*error", r"quoted string not properly terminated",
        r"oracle.*driver",
    ],
    "sqlite": [
        r"sqlite3\.operationalerror", r"sqlite\.error",
        r"unrecognized token", r"near \".*\": syntax error",
    ],
}

BOOLEAN_PAIRS = [
    ("' OR '1'='1", "' OR '1'='2"),
    ("1 OR 1=1", "1 OR 1=2"),
    ("' oR '1'='1", "' oR '1'='2"),
    ("'%20OR%20'1'='1", "'%20OR%20'1'='2"),
    ("%27%20OR%20%271%27%3D%271", "%27%20OR%20%271%27%3D%272"),
]

TIME_PAYLOADS = [
    ("' OR SLEEP(5) --", 5),
    ("'; WAITFOR DELAY '00:00:05' --", 5),
    ("' OR pg_sleep(5) --", 5),
]

ERROR_PAYLOADS = [
    "'", "\"", "\\", "' OR ''='", "1'1",
    "';", "\\'", "%27", "%22",
]


def _response_similarity(body_a: str, body_b: str) -> float:
    if not body_a and not body_b:
        return 1.0
    words_a = set(body_a.lower().split())
    words_b = set(body_b.lower().split())
    union = words_a | words_b
    if not union:
        return 1.0
    return len(words_a & words_b) / len(union)


def _check_db_errors(body: str) -> list:
    found = []
    body_lower = body.lower()
    for db_type, patterns in DB_ERROR_SIGS.items():
        for pattern in patterns:
            if re.search(pattern, body_lower):
                found.append(db_type)
                break
    return found


class SQLiDetector(BaseDetector):
    name = "SQL Injection"
    category = "Injection"
    cwe = "CWE-89"
    owasp = "A03:2021 - Injection"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings = []
        tested = 0
        endpoints_blocked = 0

        testable = [ep for ep in endpoints if (ep.all_params or ep.path_params or ep.default_params) and ep.method in ("GET", "POST", "PUT", "DELETE")]
        if not testable:
            target_url = endpoints[0].url if endpoints else "http://localhost"
            parsed = urlparse(target_url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            probe_paths = [
                "/", "/api/search", "/search", "/api/login", "/login",
                "/api/users", "/api/products", "/api/items", "/api/contact", "/contact"
            ]
            common_params = ["id", "q", "search", "query", "user", "email", "category", "filter"]
            testable = [
                EndpointInfo(url=urljoin(origin, path), method="GET", query_params=common_params)
                for path in probe_paths
            ]

        for ep in testable[:12]:
            tested += 1
            ep_reqs = 0
            ep_blocked = 0
            defaults = getattr(ep, "default_params", {}) or {}
            headers = dict(getattr(ep, "headers", {}) or {})
            params = ep.all_params[:5]
            if not params and defaults:
                params = list(defaults.keys())[:5]
            if not params and ep.path_params:
                params = ep.path_params[:5]
            if not params:
                params = ["id", "q", "search", "query", "user"]

            ep_signals = []

            # Baseline capture
            control_data = {p: defaults.get(p, "testval123") for p in params}
            ep_reqs += 1
            baseline = (engine.post(ep.url, json=control_data, headers=headers) if ep.method == "POST"
                        else engine.get(ep.url, params=control_data, headers=headers))

            if baseline.is_blocked:
                ep_blocked += 1
                if ep_blocked >= ep_reqs:
                    endpoints_blocked += 1
                continue
            if baseline.is_error:
                continue

            # --- Boolean-based testing ---
            for true_payload, false_payload in BOOLEAN_PAIRS[:4]:
                for param in params:
                    orig_val = defaults.get(param, "")
                    t_val = f"{orig_val}{true_payload}" if orig_val else true_payload
                    f_val = f"{orig_val}{false_payload}" if orig_val else false_payload

                    true_data = {p: (defaults.get(p, "testval123") if p != param else t_val) for p in params}
                    false_data = {p: (defaults.get(p, "testval123") if p != param else f_val) for p in params}

                    ep_reqs += 2
                    if ep.method == "POST":
                        resp_true = engine.post(ep.url, json=true_data, headers=headers)
                        resp_false = engine.post(ep.url, json=false_data, headers=headers)
                    else:
                        resp_true = engine.get(ep.url, params=true_data, headers=headers)
                        resp_false = engine.get(ep.url, params=false_data, headers=headers)

                    if resp_true.is_blocked:
                        ep_blocked += 1
                    if resp_false.is_blocked:
                        ep_blocked += 1
                    if resp_true.is_blocked or resp_false.is_blocked or not resp_true.has_response or not resp_false.has_response:
                        continue

                    sim_true_false = _response_similarity(resp_true.body, resp_false.body)
                    sim_true_baseline = _response_similarity(resp_true.body, baseline.body)

                    if (sim_true_false < 0.7 and sim_true_baseline < 0.8
                            and resp_true.status_code != resp_false.status_code):
                        ep_signals.append(f"boolean_differential: param={param}, similarity={sim_true_false:.2f}")

            # --- Error-based testing ---
            for payload in ERROR_PAYLOADS[:4]:
                for param in params:
                    orig_val = defaults.get(param, "")
                    err_val = f"{orig_val}{payload}" if orig_val else payload
                    err_data = {p: (defaults.get(p, "testval123") if p != param else err_val) for p in params}

                    ep_reqs += 1
                    resp = (engine.post(ep.url, json=err_data, headers=headers) if ep.method == "POST"
                            else engine.get(ep.url, params=err_data, headers=headers))

                    if resp.is_blocked:
                        ep_blocked += 1
                        continue
                    if not resp.has_response:
                        continue

                    db_matches = _check_db_errors(resp.body)
                    if db_matches:
                        ep_signals.append(f"db_error_signature: {','.join(db_matches)}, param={param}, payload={payload}")

            # --- PostgREST / Filter Injections for BaaS endpoints ---
            if "/rest/v1/" in ep.url or "supabase" in ep.url:
                for param in params:
                    if param in ("user_id", "id", "filter", "select"):
                        test_filters = [
                            f"eq.1' OR '1'='1",
                            f"neq.00000000-0000-0000-0000-000000000000",
                            f"not.is.null",
                        ]
                        for f_payload in test_filters:
                            f_data = {p: (defaults.get(p, "*") if p != param else f_payload) for p in params}
                            ep_reqs += 1
                            resp_f = engine.get(ep.url, params=f_data, headers=headers)
                            if resp_f.is_blocked:
                                ep_blocked += 1
                                continue
                            if resp_f.has_response:
                                db_m = _check_db_errors(resp_f.body)
                                if db_m:
                                    ep_signals.append(f"postgrest_db_error: {','.join(db_m)}, param={param}, payload={f_payload}")
                                elif resp_f.status_code == 200 and len(resp_f.body) > len(baseline.body) + 50:
                                    ep_signals.append(f"filter_expansion_leak: parameter '{param}' dumped table data with payload {f_payload}")

            # --- Time-based testing ---
            if len(ep_signals) < 2 and baseline_measurer is not None:
                baseline_profile = baseline_measurer.get_baseline(engine, ep.url, ep.method, json_data=control_data)
                for payload, delay in TIME_PAYLOADS[:2]:
                    for param in params[:2]:
                        orig_val = defaults.get(param, "")
                        t_val = f"{orig_val}{payload}" if orig_val else payload
                        time_data = {p: (defaults.get(p, "testval123") if p != param else t_val) for p in params}
                        ep_reqs += 1
                        if ep.method == "POST":
                            resp = engine.post(ep.url, json=time_data, headers=headers, timeout=delay + 8)
                        else:
                            resp = engine.get(ep.url, params=time_data, headers=headers, timeout=delay + 8)

                        if resp.is_blocked:
                            ep_blocked += 1
                            continue
                        if resp.is_timeout or not resp.has_response:
                            continue

                        if baseline_profile.is_time_anomalous(resp.elapsed, threshold_factor=3.0) and resp.elapsed >= delay * 0.8:
                            ep_signals.append(f"timing_statistical: elapsed={resp.elapsed:.1f}s, param={param}")

            if ep_blocked >= ep_reqs and ep_reqs > 0:
                endpoints_blocked += 1

            if ep_signals:
                has_db_error = any("db_error" in s or "postgrest_db_error" in s for s in ep_signals)
                has_expansion = any("filter_expansion_leak" in s for s in ep_signals)
                confidence_level = ConfidenceLevel.HIGH if (has_db_error or has_expansion) else ConfidenceLevel.MEDIUM

                findings.append(StandardFinding(
                    vulnerability="SQL / Database Filter Injection",
                    title=f"SQL / Database Injection at {ep.url}",
                    category="Injection",
                    severity="HIGH",
                    confidence=ConfidenceResult(
                        score=0.9,
                        level=confidence_level,
                        signals=ep_signals
                    ),
                    status=TestState.VULNERABLE,
                    endpoint=ep.url,
                    method=ep.method,
                    parameter=params[0] if params else "",
                    cvss=CVSSInfo(score=8.6, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N", severity="HIGH"),
                    owasp="A03:2021 - Injection",
                    cwe="CWE-89",
                    remediation="Use parameterized queries and strict input validation. Never concatenate raw user input into database queries or query builder filters.",
                    evidence=[Evidence(description=s) for s in ep_signals],
                ))

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        if vuln_findings:
            state = TestState.VULNERABLE
            details = f"Detected {len(vuln_findings)} SQL / Database Injection vulnerability/vulnerabilities across tested endpoints."
        elif endpoints_blocked >= tested and tested > 0:
            state = TestState.BLOCKED
            details = f"All {endpoints_blocked} endpoint probes were blocked by WAF."
        else:
            state = TestState.PASS
            details = f"Tested {tested} endpoints across Boolean differential, error-based signatures, and filter injection: no SQL injection indicators detected."

        return DetectorResult(
            test_state=state,
            findings=vuln_findings,
            details=details,
            endpoints_tested=max(tested, 1),
            endpoints_blocked=endpoints_blocked,
        )
