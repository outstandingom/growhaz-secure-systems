"""GraphQL Detector — introspection, query depth, and misconfiguration checks."""
import json
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer

INTROSPECTION_QUERY = '{"query":"{ __schema { types { name } } }"}'
DEPTH_QUERY = '{"query":"{ __schema { types { fields { type { fields { type { name } } } } } } }"}'
GRAPHQL_PATHS = ["/graphql", "/api/graphql", "/graphql/v1", "/gql"]

class GraphQLDetector(BaseDetector):
    name = "GraphQL Misconfiguration"
    category = "Security Misconfiguration"
    cwe = "CWE-200"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0

        # Find graphql endpoints
        gql_endpoints = [ep for ep in endpoints if ep.is_graphql or 'graphql' in ep.url.lower() or 'gql' in ep.url.lower()]

        # Also probe common paths
        base_url = endpoints[0].url.rsplit('/', 1)[0] if endpoints else ""
        if base_url:
            for path in GRAPHQL_PATHS:
                from ..models.endpoint import EndpointInfo, DiscoverySource
                probe_url = base_url.rstrip('/') + path
                resp = engine.post(probe_url, data=INTROSPECTION_QUERY, headers={"Content-Type": "application/json"})
                if resp.has_response and resp.status_code == 200 and "__schema" in resp.body:
                    ep = EndpointInfo(url=probe_url, method="POST", is_graphql=True, discovery_source=DiscoverySource.COMMON_PATH)
                    gql_endpoints.append(ep)

        if not gql_endpoints:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No GraphQL endpoints found")

        for ep in gql_endpoints[:5]:
            tested += 1
            signals = []

            # Test introspection
            resp = engine.post(ep.url, data=INTROSPECTION_QUERY, headers={"Content-Type": "application/json"})
            if resp.is_blocked: blocked += 1; continue
            if not resp.has_response: continue

            if resp.status_code == 200 and "__schema" in resp.body:
                try:
                    data = json.loads(resp.body)
                    types = data.get("data", {}).get("__schema", {}).get("types", [])
                    if types:
                        signals.append(f"introspection_enabled: {len(types)} types exposed")
                except (json.JSONDecodeError, KeyError):
                    signals.append("introspection_enabled: schema data returned")

            # Test query depth limiting
            resp_depth = engine.post(ep.url, data=DEPTH_QUERY, headers={"Content-Type": "application/json"})
            if resp_depth.has_response and resp_depth.status_code == 200 and "error" not in resp_depth.body.lower():
                signals.append("no_query_depth_limiting: deeply nested query accepted")

            if signals:
                confidence = ConfidenceResult.from_signals(signals)
                sev = "MEDIUM" if "introspection_enabled" in str(signals) else "LOW"
                findings.append(StandardFinding(
                    vulnerability="GraphQL Introspection Enabled", category=self.category,
                    severity=sev, confidence=confidence, status=TestState.VULNERABLE,
                    endpoint=ep.url, method="POST",
                    cvss=CVSSInfo(score=5.3, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", severity="MEDIUM"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Disable introspection in production. Implement query depth and complexity limits.",
                    evidence=[Evidence(description=s) for s in signals],
                ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} GraphQL endpoints.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
