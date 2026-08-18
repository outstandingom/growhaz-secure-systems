"""GraphQL Detector — introspection, field suggestions, and DoS via depth/alias/batch."""
import json
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel

INTROSPECTION_QUERY = '{"query":"{ __schema { types { name } } }"}'
FIELD_SUGGEST_QUERY = '{"query":"{ __typoo }"}'
DEEP_QUERY = '{"query":"query { user { posts { comments { author { posts { comments { author { name } } } } } } } }"}'
ALIAS_DOS = '{"query":"query { ' + " ".join(f"a{i}: user {{ id }}" for i in range(80)) + ' }"}'
BATCH_QUERY = "[" + ",".join('{"query":"{ user(id: %d) { id name } }"}' % i for i in range(30)) + "]"
GRAPHQL_PATHS = ["/graphql", "/api/graphql", "/graphql/v1", "/gql", "/query", "/api/query"]


class GraphQLDetector(BaseDetector):
    name = "GraphQL Misconfiguration"
    category = "Security Misconfiguration"
    cwe = "CWE-200"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0

        gql_endpoints = [ep for ep in endpoints if getattr(ep, "is_graphql", False)
                         or "graphql" in ep.url.lower() or "gql" in ep.url.lower()]

        # Probe well-known paths
        if endpoints:
            from urllib.parse import urlparse
            u = urlparse(endpoints[0].url)
            base_origin = f"{u.scheme}://{u.netloc}"
            for path in GRAPHQL_PATHS:
                probe_url = base_origin + path
                r = engine.post(probe_url, data=INTROSPECTION_QUERY,
                                headers={"Content-Type": "application/json"})
                if r.has_response and r.status_code == 200 and "__schema" in r.body:
                    from ..models.endpoint import EndpointInfo, DiscoverySource
                    gql_endpoints.append(EndpointInfo(url=probe_url, method="POST", is_graphql=True,
                                                     discovery_source=DiscoverySource.COMMON_PATH))

        # dedupe
        seen = set()
        gql_endpoints = [e for e in gql_endpoints if not (e.url in seen or seen.add(e.url))]

        if not gql_endpoints:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE,
                                  details="No GraphQL endpoints found")

        for ep in gql_endpoints[:5]:
            tested += 1
            signals = []
            hdrs = {"Content-Type": "application/json"}

            # Introspection
            r = engine.post(ep.url, data=INTROSPECTION_QUERY, headers=hdrs)
            if r.is_blocked:
                blocked += 1
            elif r.has_response and r.status_code == 200 and "__schema" in r.body:
                try:
                    types = json.loads(r.body).get("data", {}).get("__schema", {}).get("types", [])
                    signals.append(f"introspection_enabled: {len(types)} types exposed")
                except Exception:
                    signals.append("introspection_enabled: schema returned")

            # Field suggestions
            r = engine.post(ep.url, data=FIELD_SUGGEST_QUERY, headers=hdrs)
            if r.has_response and "did you mean" in r.body.lower():
                signals.append("field_suggestions_enabled: schema leak via typo suggestion")

            # DoS: deep query
            r = engine.post(ep.url, data=DEEP_QUERY, headers=hdrs, timeout=10)
            if r.is_timeout or (r.has_response and r.elapsed > 5):
                signals.append(f"no_query_depth_limit: deep query elapsed={r.elapsed:.1f}s")

            # DoS: alias
            r = engine.post(ep.url, data=ALIAS_DOS, headers=hdrs, timeout=10)
            if r.is_timeout or (r.has_response and r.status_code == 200 and r.elapsed > 5):
                signals.append(f"no_alias_limit: 80 aliases accepted, elapsed={r.elapsed:.1f}s")

            # DoS: batching
            r = engine.post(ep.url, data=BATCH_QUERY, headers=hdrs, timeout=10)
            if r.has_response and r.status_code == 200 and "[" in r.body[:5]:
                signals.append("batching_enabled: 30-query batch accepted")

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                sev = "HIGH" if any("no_query_depth" in s or "no_alias" in s for s in signals) else "MEDIUM"
                findings.append(StandardFinding(
                    vulnerability="GraphQL Misconfiguration",
                    category=self.category,
                    severity=sev, confidence=confidence, status=TestState.VULNERABLE,
                    endpoint=ep.url, method="POST",
                    cvss=CVSSInfo(score=6.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L", severity="MEDIUM"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Disable introspection and field-suggestions in production. Enforce query depth (<= 6), complexity, and alias/batch limits.",
                    description="GraphQL endpoint exposes schema information or allows unbounded query cost.",
                    evidence=[Evidence(description=s) for s in signals],
                ))

        state = (TestState.VULNERABLE if findings
                 else TestState.BLOCKED if blocked >= tested and tested > 0
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(test_state=state, findings=findings,
                              details=f"Tested {tested} GraphQL endpoints.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
