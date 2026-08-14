"""
SQL Injection Detector — evidence-driven, false-positive-resistant.

Detection approach:
1. Baseline capture with control payload
2. Boolean-based: response SIMILARITY comparison (not just length)
3. Time-based: statistical analysis (median + stddev)
4. Error-based: database error signatures
5. Confidence scoring: single signal = LOW, never VULNERABLE alone
"""

from typing import List
import re
import time

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, ResponseEvidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine, RequestResult
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer, BaselineProfile
from ..models.endpoint import EndpointInfo


# Database error signatures by DB type
DB_ERROR_SIGS = {
    "mysql": [
        r"you have an error in your sql syntax",
        r"mysql_fetch", r"mysql_num_rows", r"mysql_query",
        r"warning.*mysql", r"unclosed quotation mark",
        r"supplied argument is not a valid mysql",
    ],
    "postgresql": [
        r"pg_query", r"pg_exec", r"postgresql.*error",
        r"unterminated quoted string", r"invalid input syntax for",
        r"current transaction is aborted",
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
    ("' OR 1=1 --", "' OR 1=2 --"),
    ("' AND '1'='1", "' AND '1'='2"),
    ("1 OR 1=1", "1 OR 1=2"),
]

TIME_PAYLOADS = [
    ("' OR SLEEP(5) --", 5),
    ("' AND SLEEP(5) --", 5),
    ("'; WAITFOR DELAY '00:00:05' --", 5),
    ("' OR pg_sleep(5) --", 5),
]

ERROR_PAYLOADS = ["'", "\"", "\\", "' OR ''='", "1'1"]


def _response_similarity(body_a: str, body_b: str) -> float:
    """Jaccard similarity on word sets (0.0–1.0)."""
    if not body_a and not body_b:
        return 1.0
    words_a = set(body_a.lower().split())
    words_b = set(body_b.lower().split())
    union = words_a | words_b
    if not union:
        return 1.0
    return len(words_a & words_b) / len(union)


def _check_db_errors(body: str) -> list:
    """Check response body for database error signatures. Returns list of matched DB types."""
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
        blocked = 0

        # Filter endpoints with parameters
        testable = [ep for ep in endpoints if ep.all_params and ep.method in ("GET", "POST")]
        if not testable:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No endpoints with injectable parameters found"
            )

        for ep in testable:
            tested += 1
            params = ep.all_params[:5]  # Limit params per endpoint
            ep_signals = []

            # Get baseline with benign input
            control_data = {p: "testvalue123" for p in params}
            baseline = engine.post(ep.url, json=control_data) if ep.method == "POST" else engine.get(ep.url, params=control_data)

            if baseline.is_blocked:
                blocked += 1
                continue
            if baseline.is_error:
                continue

            # --- Boolean-based testing ---
            for true_payload, false_payload in BOOLEAN_PAIRS:
                for param in params:
                    true_data = {p: ("testvalue123" if p != param else true_payload) for p in params}
                    false_data = {p: ("testvalue123" if p != param else false_payload) for p in params}

                    if ep.method == "POST":
                        resp_true = engine.post(ep.url, json=true_data)
                        resp_false = engine.post(ep.url, json=false_data)
                    else:
                        resp_true = engine.get(ep.url, params=true_data)
                        resp_false = engine.get(ep.url, params=false_data)

                    if resp_true.is_blocked or resp_false.is_blocked:
                        blocked += 1
                        continue
                    if not resp_true.has_response or not resp_false.has_response:
                        continue

                    # Compare true vs false AND true vs baseline
                    sim_true_false = _response_similarity(resp_true.body, resp_false.body)
                    sim_true_baseline = _response_similarity(resp_true.body, baseline.body)
                    sim_false_baseline = _response_similarity(resp_false.body, baseline.body)

                    # Signal: true condition response differs from false AND from baseline
                    if (sim_true_false < 0.7
                            and sim_true_baseline < 0.8
                            and resp_true.status_code != resp_false.status_code):
                        ep_signals.append(f"boolean_differential: param={param}, similarity={sim_true_false:.2f}")

            # --- Error-based testing ---
            for payload in ERROR_PAYLOADS:
                for param in params:
                    err_data = {p: ("testvalue123" if p != param else payload) for p in params}
                    if ep.method == "POST":
                        resp = engine.post(ep.url, json=err_data)
                    else:
                        resp = engine.get(ep.url, params=err_data)

                    if resp.is_blocked:
                        blocked += 1
                        continue
                    if not resp.has_response:
                        continue

                    db_matches = _check_db_errors(resp.body)
                    if db_matches:
                        ep_signals.append(f"db_error_signature: {','.join(db_matches)}, param={param}")

            # --- Time-based testing (only if no strong signals yet) ---
            if len(ep_signals) < 2:
                baseline_profile = baseline_measurer.get_baseline(engine, ep.url, ep.method, json_data=control_data)
                for payload, delay in TIME_PAYLOADS[:2]:  # Limit expensive time tests
                    for param in params[:2]:
                        time_data = {p: ("testvalue123" if p != param else payload) for p in params}
                        if ep.method == "POST":
                            resp = engine.post(ep.url, json=time_data, timeout=delay + 10)
                        else:
                            resp = engine.get(ep.url, params=time_data, timeout=delay + 10)

                        if resp.is_blocked:
                            blocked += 1
                            continue
                        if resp.is_timeout:
                            # Timeout alone is not conclusive
                            continue

                        if resp.has_response and baseline_profile.is_time_anomalous(resp.elapsed, threshold_factor=3.0):
                            if resp.elapsed >= delay * 0.8:
                                ep_signals.append(f"timing_statistical: elapsed={resp.elapsed:.1f}s, baseline_median={baseline_profile.median_time:.1f}s, param={param}")

            # --- Evaluate signals for this endpoint ---
            if ep_signals:
                confidence = ConfidenceResult.from_signals(ep_signals)

                # Only report as VULNERABLE with MEDIUM+ confidence
                if confidence.level in (ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED):
                    finding = StandardFinding(
                        vulnerability="SQL Injection",
                        category="Injection",
                        severity="HIGH" if confidence.level in (ConfidenceLevel.HIGH, ConfidenceLevel.CONFIRMED) else "MEDIUM",
                        confidence=confidence,
                        status=TestState.VULNERABLE,
                        endpoint=ep.url,
                        method=ep.method,
                        parameter=params[0] if params else "",
                        cvss=CVSSInfo(score=8.6, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N", severity="HIGH"),
                        owasp="A03:2021 - Injection",
                        cwe="CWE-89",
                        remediation="Use parameterized queries/prepared statements. Never concatenate user input into SQL.",
                        evidence=[Evidence(description=s) for s in ep_signals],
                    )
                    findings.append(finding)
                else:
                    # LOW confidence = INCONCLUSIVE, not PASS
                    findings.append(StandardFinding(
                        vulnerability="SQL Injection (Possible)",
                        category="Injection",
                        severity="LOW",
                        confidence=confidence,
                        status=TestState.INCONCLUSIVE,
                        endpoint=ep.url,
                        method=ep.method,
                        owasp="A03:2021 - Injection",
                        cwe="CWE-89",
                        evidence=[Evidence(description=s) for s in ep_signals],
                    ))

        # Determine overall state
        if any(f.status == TestState.VULNERABLE for f in findings):
            state = TestState.VULNERABLE
        elif blocked >= tested and tested > 0:
            state = TestState.BLOCKED
        elif any(f.status == TestState.INCONCLUSIVE for f in findings):
            state = TestState.INCONCLUSIVE
        elif tested > 0:
            state = TestState.PASS
        else:
            state = TestState.NOT_APPLICABLE

        vuln_findings = [f for f in findings if f.status == TestState.VULNERABLE]
        return DetectorResult(
            test_state=state,
            findings=vuln_findings if vuln_findings else findings,
            details=f"Tested {tested} endpoints. {len(vuln_findings)} vulnerable, {blocked} blocked.",
            endpoints_tested=tested,
            endpoints_blocked=blocked,
        )
