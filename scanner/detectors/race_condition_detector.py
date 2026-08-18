"""
Race Condition Detector — concurrent request bursts on money/reward endpoints.

Signal: N concurrent identical requests all return 2xx success where the
expected behavior is that only one should succeed (once-only redemption).
"""
import threading
import time
from typing import List

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence
from ..models.confidence import ConfidenceResult, ConfidenceLevel


RACE_HINTS = ("coupon", "redeem", "transfer", "withdraw", "deposit", "checkout",
              "vote", "like", "claim", "bonus", "reward", "invite", "referral")


class RaceConditionDetector(BaseDetector):
    name = "Race Condition"
    category = "Insecure Design"
    cwe = "CWE-362"
    owasp = "A04:2021 - Insecure Design"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        targets = []
        seen = set()
        for ep in endpoints:
            if any(h in ep.url.lower() for h in RACE_HINTS) and ep.method in ("POST", "PUT"):
                if ep.url not in seen:
                    seen.add(ep.url)
                    targets.append(ep.url)

        if not targets:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No race-condition candidate endpoints found",
            )

        findings: List[StandardFinding] = []
        tested = 0

        for url in targets[:4]:
            tested += 1
            payload = {"code": "GHZ_RACE", "id": 1, "quantity": 1, "amount": 1}
            n = 15
            results = [None] * n

            def worker(i):
                r = engine.post(url, json=payload, timeout=8)
                results[i] = (r.status_code, r.is_blocked)

            threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
            start = time.time()
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=15)
            duration = time.time() - start

            # If they landed within a tight window and many succeeded, flag
            successes = sum(1 for r in results if r and r[0] in (200, 201) and not r[1])
            if successes >= 5 and duration < 8:
                findings.append(StandardFinding(
                    vulnerability="Race Condition (TOCTOU)",
                    title="Race Condition (TOCTOU)",
                    category=self.category,
                    severity="HIGH",
                    confidence=ConfidenceResult(ConfidenceLevel.MEDIUM,
                                               f"{successes}/{n} concurrent requests accepted within {duration:.1f}s"),
                    status=TestState.VULNERABLE,
                    endpoint=url,
                    method="POST",
                    cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:H/A:N", severity="HIGH"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Use database-level constraints (unique indexes, row locks, SELECT FOR UPDATE) or atomic increments. Do not rely on read-then-write logic for once-only operations.",
                    description=f"Sent {n} identical requests in parallel; {successes} succeeded. If this endpoint should only allow one redemption per user, it is exploitable.",
                    evidence=[Evidence(description=f"parallel_burst: {successes}/{n} successful in {duration:.2f}s")],
                ))

        state = (TestState.VULNERABLE if findings
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(
            test_state=state, findings=findings,
            details=f"Race-tested {tested} endpoints. {len(findings)} exploitable.",
            endpoints_tested=tested,
        )
