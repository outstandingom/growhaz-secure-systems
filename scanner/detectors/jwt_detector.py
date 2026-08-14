"""JWT Vulnerabilities Detector."""
import base64, json, re
from typing import List
from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel
from ..engine.request_engine import RequestEngine
from ..engine.auth_context import AuthContext
from ..engine.baseline import BaselineMeasurer
from ..models.endpoint import EndpointInfo

JWT_RE = re.compile(r'eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+')

def _decode_jwt_part(part):
    try:
        padded = part + '=' * (4 - len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        return None

def _make_none_token(token):
    """Create a JWT with alg=none and no signature."""
    parts = token.split('.')
    if len(parts) != 3: return None
    header = _decode_jwt_part(parts[0])
    if not header: return None
    header['alg'] = 'none'
    new_header = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b'=').decode()
    return f"{new_header}.{parts[1]}."

class JWTDetector(BaseDetector):
    name = "JWT Vulnerabilities"
    category = "Identification and Authentication Failures"
    cwe = "CWE-347"
    owasp = "A07:2021 - Identification and Authentication Failures"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        findings, tested, blocked = [], 0, 0

        # Find JWT tokens in auth context or by probing login
        jwt_token = None
        if auth_context.user_a.token and JWT_RE.match(auth_context.user_a.token):
            jwt_token = auth_context.user_a.token

        if not jwt_token:
            # Try to find JWTs in responses
            for ep in endpoints[:5]:
                resp = engine.get(ep.url)
                if resp.has_response:
                    match = JWT_RE.search(resp.body)
                    if match:
                        jwt_token = match.group(0)
                        break
                    # Check response headers
                    for h_val in resp.headers.values():
                        match = JWT_RE.search(str(h_val))
                        if match:
                            jwt_token = match.group(0)
                            break

        if not jwt_token:
            return DetectorResult(test_state=TestState.NOT_APPLICABLE, details="No JWT tokens found in auth context or responses")

        # Find protected endpoints to test against
        protected = [ep for ep in endpoints if ep.auth_required or ep.is_state_changing][:5]
        if not protected:
            protected = endpoints[:3]

        # --- Test 1: alg=none bypass ---
        none_token = _make_none_token(jwt_token)
        if none_token:
            for ep in protected:
                tested += 1
                # Get baseline with valid token
                resp_valid = engine.request(ep.method, ep.url, headers={"Authorization": f"Bearer {jwt_token}"})
                if resp_valid.is_blocked: blocked += 1; continue
                if not resp_valid.has_response or resp_valid.status_code >= 400: continue

                # Test with none algorithm
                resp_none = engine.request(ep.method, ep.url, headers={"Authorization": f"Bearer {none_token}"})
                if resp_none.is_blocked: blocked += 1; continue

                if resp_none.has_response and resp_none.status_code == 200:
                    # Check if response is similar to valid token response
                    if len(resp_none.body) > 50 and resp_valid.body:
                        words_valid = set(resp_valid.body.lower().split())
                        words_none = set(resp_none.body.lower().split())
                        if words_valid and words_none:
                            overlap = len(words_valid & words_none) / max(len(words_valid), 1)
                            if overlap > 0.6:
                                findings.append(StandardFinding(
                                    vulnerability="JWT 'none' Algorithm Bypass", category=self.category,
                                    severity="CRITICAL",
                                    confidence=ConfidenceResult(0.9, ConfidenceLevel.CONFIRMED,
                                        signals=["token_accepted_without_signature: alg=none accepted with similar response"]),
                                    status=TestState.VULNERABLE, endpoint=ep.url, method=ep.method,
                                    cvss=CVSSInfo(score=9.8, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", severity="CRITICAL"),
                                    owasp=self.owasp, cwe=self.cwe,
                                    remediation="Reject tokens with alg='none'. Whitelist allowed algorithms.",
                                    evidence=[Evidence(description="JWT with alg=none accepted by server")],
                                ))

        # --- Test 2: Empty/invalid signature ---
        parts = jwt_token.split('.')
        if len(parts) == 3:
            tampered_token = f"{parts[0]}.{parts[1]}.invalidsignature"
            for ep in protected[:3]:
                tested += 1
                resp_valid = engine.request(ep.method, ep.url, headers={"Authorization": f"Bearer {jwt_token}"})
                if resp_valid.is_blocked or not resp_valid.has_response: continue
                if resp_valid.status_code >= 400: continue

                resp_tampered = engine.request(ep.method, ep.url, headers={"Authorization": f"Bearer {tampered_token}"})
                if resp_tampered.is_blocked: blocked += 1; continue

                if resp_tampered.has_response and resp_tampered.status_code == 200:
                    findings.append(StandardFinding(
                        vulnerability="JWT Missing Signature Validation", category=self.category,
                        severity="HIGH",
                        confidence=ConfidenceResult(0.8, ConfidenceLevel.HIGH,
                            signals=["token_accepted_without_signature: tampered signature accepted"]),
                        status=TestState.VULNERABLE, endpoint=ep.url, method=ep.method,
                        cvss=CVSSInfo(score=8.1, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N", severity="HIGH"),
                        owasp=self.owasp, cwe=self.cwe,
                        remediation="Always validate JWT signatures server-side. Use strong signing keys.",
                        evidence=[Evidence(description="JWT with invalid signature accepted")],
                    ))

        vuln = [f for f in findings if f.status == TestState.VULNERABLE]
        state = TestState.VULNERABLE if vuln else (TestState.BLOCKED if blocked >= tested and tested > 0 else (TestState.PASS if tested > 0 else TestState.NOT_APPLICABLE))
        return DetectorResult(test_state=state, findings=findings, details=f"Tested {tested} endpoints. {len(vuln)} JWT issues found.",
                              endpoints_tested=tested, endpoints_blocked=blocked)
