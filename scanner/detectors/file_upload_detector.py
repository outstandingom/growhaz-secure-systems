"""
File Upload Detector — dangerous file type and extension-bypass checks.
"""
from typing import List

from .base_detector import BaseDetector, DetectorResult
from ..models.test_state import TestState
from ..models.finding import StandardFinding, CVSSInfo
from ..models.evidence import Evidence, RequestEvidence, ResponseEvidence, safe_body_snippet
from ..models.confidence import ConfidenceResult, ConfidenceLevel


UPLOAD_HINTS = ("upload", "avatar", "profile", "attachment", "media", "photo", "picture", "image", "file", "document")

MALICIOUS_FILES = [
    ("shell.php", b'<?php echo "GHZ_UPLOAD_PROOF"; ?>', "application/x-php"),
    ("shell.phtml", b'<?php echo "GHZ_UPLOAD_PROOF"; ?>', "application/x-httpd-php"),
    ("shell.jsp", b'<% out.println("GHZ_UPLOAD_PROOF"); %>', "application/x-jsp"),
    ("shell.aspx", b'<%@ Page Language="C#" %><% Response.Write("GHZ_UPLOAD_PROOF"); %>', "application/x-aspx"),
    ("xss.svg", b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "image/svg+xml"),
    ("xss.html", b'<script>alert("GHZ_UPLOAD_PROOF")</script>', "text/html"),
]

DOUBLE_EXT = [
    ("shell.php.jpg", "image/jpeg"),
    ("shell.php%00.jpg", "image/jpeg"),
    ("shell.asp;.jpg", "image/jpeg"),
    ("shell.php5", "image/jpeg"),
    ("shell.pHp", "image/jpeg"),
]

SUCCESS_HINTS = ("uploaded", "success", "saved", "created", "stored", "\"url\"", "\"path\"", "\"filename\"")


class FileUploadDetector(BaseDetector):
    name = "Unrestricted File Upload"
    category = "Security Misconfiguration"
    cwe = "CWE-434"
    owasp = "A05:2021 - Security Misconfiguration"

    def _run(self, endpoints, engine, auth_context, baseline_measurer):
        candidates = []
        seen = set()
        for ep in endpoints:
            url_l = ep.url.lower()
            if any(h in url_l for h in UPLOAD_HINTS) and ep.method in ("POST", "PUT"):
                if ep.url not in seen:
                    seen.add(ep.url)
                    candidates.append(ep.url)

        if not candidates:
            return DetectorResult(
                test_state=TestState.NOT_APPLICABLE,
                details="No upload-like endpoints discovered",
            )

        findings: List[StandardFinding] = []
        tested = 0
        blocked = 0

        for url in candidates[:8]:
            tested += 1
            ep_signals = []
            proof = ""

            for name, content, ctype in MALICIOUS_FILES:
                try:
                    resp = engine.request(
                        "POST", url,
                        headers={"Content-Type": None} if False else None,
                        data={"upload": "1"},
                    )
                except Exception:
                    continue
                # Requests file upload via engine.request lacks 'files' — use session directly
                try:
                    r = engine.session.post(
                        url,
                        files={"file": (name, content, ctype)},
                        timeout=engine.default_timeout,
                        verify=engine.verify_ssl,
                    )
                    body = r.text or ""
                    status = r.status_code
                except Exception:
                    continue

                if status in (401, 403):
                    # auth-gated; skip further tries for this endpoint
                    break
                if status == 429:
                    blocked += 1
                    break

                low = body.lower()
                if status in (200, 201) and any(h in low for h in SUCCESS_HINTS):
                    ep_signals.append(f"upload_accepted: {name} ({ctype}) -> HTTP {status}")
                    proof = body[:500]
                    # try to fetch back if URL echoed
                    m = None
                    for key in ("url", "path", "filename", "location"):
                        idx = low.find(f'"{key}"')
                        if idx != -1:
                            m = body[idx:idx + 300]
                            break
                    if m:
                        ep_signals.append(f"upload_location_echoed: {m[:120]}")
                    break

            for name, ctype in DOUBLE_EXT:
                try:
                    r = engine.session.post(
                        url,
                        files={"file": (name, b"GHZ_UPLOAD_PROOF", ctype)},
                        timeout=engine.default_timeout,
                        verify=engine.verify_ssl,
                    )
                    if r.status_code in (200, 201) and any(h in (r.text or "").lower() for h in SUCCESS_HINTS):
                        ep_signals.append(f"extension_bypass_accepted: {name}")
                        proof = proof or (r.text or "")[:500]
                        break
                except Exception:
                    continue

            if ep_signals:
                confidence = ConfidenceResult.from_signals(ep_signals)
                sev = "HIGH" if any("upload_accepted" in s for s in ep_signals) else "MEDIUM"
                findings.append(StandardFinding(
                    vulnerability="Unrestricted File Upload",
                    title="Unrestricted File Upload",
                    category=self.category,
                    severity=sev,
                    confidence=confidence,
                    status=TestState.VULNERABLE,
                    endpoint=url,
                    method="POST",
                    cvss=CVSSInfo(score=8.8, vector="CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", severity="HIGH"),
                    owasp=self.owasp, cwe=self.cwe,
                    remediation="Enforce server-side MIME + magic-byte validation, strict extension allow-lists, random filenames, and serve uploads from a non-executable location or CDN.",
                    description="Server accepted a file with an executable or active-content type. This can lead to remote code execution or stored XSS.",
                    evidence=[
                        Evidence(
                            description=s,
                            response=ResponseEvidence(body_snippet=safe_body_snippet(proof)) if proof else None,
                        )
                        for s in ep_signals
                    ],
                ))

        state = (TestState.VULNERABLE if findings
                 else TestState.BLOCKED if blocked >= tested and tested > 0
                 else TestState.PASS if tested > 0
                 else TestState.NOT_APPLICABLE)
        return DetectorResult(
            test_state=state,
            findings=findings,
            details=f"Probed {tested} upload endpoints. {len(findings)} vulnerable.",
            endpoints_tested=tested,
            endpoints_blocked=blocked,
        )
