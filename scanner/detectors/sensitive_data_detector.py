"""
Sensitive Data Exposure Detector.

Detects:
1. Exposed environment configuration files (.env, .env.local, .env.production, .env.example, .env.swp).
2. Exposed Git repositories (/.git/HEAD, /.git/config, /.git/index).
3. Secret keys, API tokens, and credentials in client JavaScript bundles and chunks (Vite/Webpack/Next.js).
4. Database backups and exposed config files (/backup.sql, /config.json, /package.json).
"""

import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from scanner.detectors.base_detector import BaseDetector, DetectorResult
from scanner.models.test_state import TestState
from scanner.models.finding import StandardFinding, CVSSInfo
from scanner.models.evidence import RequestEvidence, ResponseEvidence, Evidence, redact_sensitive, safe_body_snippet
from scanner.models.confidence import ConfidenceLevel, ConfidenceResult


SENSITIVE_PATHS = {
    "/.env": ("Exposed Environment Configuration (.env)", "High", 7.5, "CWE-552", "Environment configuration file containing secret keys, database credentials, or API tokens."),
    "/.env.local": ("Exposed Local Environment File (.env.local)", "High", 7.5, "CWE-552", "Local environment file with secrets."),
    "/.env.production": ("Exposed Production Environment File (.env.production)", "High", 8.2, "CWE-552", "Production environment file with live secrets."),
    "/.env.development": ("Exposed Development Environment File (.env.development)", "Medium", 6.5, "CWE-552", "Development environment configuration file."),
    "/.env.example": ("Exposed Sample Environment File (.env.example)", "Low", 3.7, "CWE-200", "Sample environment configuration revealing architecture and variable naming."),
    "/.env.swp": ("Exposed Vim Swap File (.env.swp)", "High", 7.5, "CWE-552", "Vim text editor swap file containing uncommitted environment secrets."),
    "/..env.swp": ("Exposed Root Vim Swap File (..env.swp)", "High", 7.5, "CWE-552", "Hidden Vim text editor swap file containing environment secrets."),
    "/.git/HEAD": ("Exposed Git Source Code Repository (/.git/HEAD)", "High", 7.5, "CWE-538", "Git version control directory is publicly accessible, allowing source code download."),
    "/.git/config": ("Exposed Git Configuration (/.git/config)", "High", 7.5, "CWE-538", "Git repository config exposing remote repository URLs, tokens, and branch names."),
    "/package.json": ("Exposed Node.js Package Manifest (/package.json)", "Medium", 5.3, "CWE-200", "Application manifest exposes package versions, internal scripts, and dependencies."),
    "/config.json": ("Exposed Application Configuration (/config.json)", "Medium", 5.3, "CWE-200", "Application configuration file accessible without authentication."),
    "/backup.sql": ("Exposed Database Backup File (/backup.sql)", "Critical", 9.8, "CWE-530", "Full database dump file exposed publicly."),
    "/phpinfo.php": ("Exposed PHP Environment Info (/phpinfo.php)", "Medium", 5.3, "CWE-200", "phpinfo() output exposes full server configuration, module versions, and internal paths."),
}

SECRET_PATTERNS = {
    "AWS Access Key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "Stripe Secret Key": re.compile(r"\bsk_live_[0-9a-zA-Z]{24,}\b"),
    "GitHub Access Token": re.compile(r"\bghp_[0-9a-zA-Z]{36}\b"),
    "RSA/Private SSH Key": re.compile(r"-----BEGIN [A-Z]+ PRIVATE KEY-----"),
    "Database Connection URL": re.compile(r"\b(?:postgres|postgresql|mongodb|mysql):\/\/[^\s\"']+\b"),
    "Ethereum / Blockchain Private Key": re.compile(r"\b0x[a-fA-F0-9]{64}\b"),
    "Razorpay Key ID": re.compile(r"\brzp_(?:live|test)_[a-zA-Z0-9]{14,}\b"),
    "Google / Firebase API Key": re.compile(r"\bAIza[0-9A-Za-z-_]{35}\b"),
    "Supabase Service Role Key": re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]*service_role[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]{10,}'),
}

ENV_VAR_RE = re.compile(r'\b(?:VITE_|REACT_APP_|NEXT_PUBLIC_)[A-Z0-9_]{3,}\b')
JS_CHUNK_RE = re.compile(r'[a-zA-Z0-9_.-]+\.js')


class SensitiveDataDetector(BaseDetector):
    name = "Sensitive Data Exposure Detector"
    category = "Cryptographic Failures & Exposure"
    cwe = "CWE-200"
    owasp = "A02:2021-Cryptographic Failures"

    def _run(self, endpoints, engine, auth_context, baseline_measurer) -> DetectorResult:
        result = DetectorResult()
        
        urls_to_test = [ep.url for ep in endpoints] if endpoints else []
        if not urls_to_test:
            urls_to_test = [engine.session.headers.get("Host", "https://target")]

        base_url = urls_to_test[0]
        parsed_base = urlparse(base_url)
        origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"

        result.test_state = TestState.PASS

        # ---------------------------------------------------------
        # 1. Probe for exposed sensitive files and environment configs
        # ---------------------------------------------------------
        for path, (title, sev_str, score, cwe_id, desc) in SENSITIVE_PATHS.items():
            test_target = urljoin(origin_url, path)
            req_res = engine.request("GET", test_target)
            result.endpoints_tested += 1

            if req_res.is_error or req_res.is_blocked:
                continue

            if req_res.status_code == 200 and req_res.body:
                ct = (req_res.headers.get("Content-Type", "") or "").lower()
                body_lower = req_res.body.lower()

                # Guard against SPA 200 Catch-Alls: if an SPA returns its HTML index page on 404, ignore it!
                if "html" in ct or "<!doctype html" in body_lower or "<html" in body_lower:
                    continue

                is_valid_exposure = False
                if ".env" in path:
                    # Valid env file must have KEY=VALUE lines
                    if "=" in req_res.body and any(k in body_lower for k in ("key", "secret", "url", "db", "api", "token", "password", "vite", "port", "host")):
                        is_valid_exposure = True
                    # Or vim swap file
                    elif "b0vim" in body_lower or "vim" in body_lower:
                        is_valid_exposure = True
                elif path == "/.git/HEAD" and ("ref: refs/" in req_res.body or "master" in req_res.body or "main" in req_res.body):
                    is_valid_exposure = True
                elif path == "/.git/config" and ("[core]" in body_lower or "[remote" in body_lower or "url =" in body_lower):
                    is_valid_exposure = True
                elif path == "/package.json" and ('"name"' in req_res.body or '"dependencies"' in req_res.body):
                    is_valid_exposure = True
                elif path == "/config.json" and ('{' in req_res.body and '}' in req_res.body):
                    is_valid_exposure = True
                elif path == "/phpinfo.php" and ("php version" in body_lower or "system" in body_lower):
                    is_valid_exposure = True
                elif "sql" in path and ("insert into" in body_lower or "create table" in body_lower):
                    is_valid_exposure = True

                if is_valid_exposure:
                    confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Successfully accessed sensitive file at {path}")
                    cvss = CVSSInfo(score=score, vector=f"CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity=sev_str.upper())
                    finding = StandardFinding(
                        title=title,
                        description=f"{desc} (Endpoint: {test_target})",
                        severity=sev_str,
                        cwe=cwe_id,
                        owasp=self.owasp,
                        cvss=cvss,
                        confidence=confidence,
                        remediation=f"Block public web server access to {path} in Nginx/Apache/Vercel/Cloudflare configuration.",
                        evidence=[Evidence(
                            request=RequestEvidence(method="GET", url=test_target),
                            response=ResponseEvidence(status_code=200, headers=req_res.headers, body_snippet=safe_body_snippet(redact_sensitive(req_res.body)))
                        )]
                    )
                    result.findings.append(finding)
                    result.test_state = TestState.VULNERABLE

        # ---------------------------------------------------------
        # 2. Deep Secret & Credential Scanning in Client Bundles & Chunks
        # ---------------------------------------------------------
        seen_scripts = set()
        scripts_to_scan = set()

        # Step A: Collect scripts from homepage HTML
        try:
            home_resp = engine.get(origin_url)
            if home_resp.has_response and home_resp.body:
                soup = BeautifulSoup(home_resp.body, 'html.parser')
                for s in soup.find_all('script', src=True):
                    src = s.get('src')
                    if src:
                        scripts_to_scan.add(urljoin(origin_url, src))
        except Exception:
            pass

        # Step B: Add known bundle endpoints from discovery
        for u in urls_to_test:
            if u.endswith('.js') or '/assets/' in u:
                scripts_to_scan.add(u)

        # Step C: Recursively scan entry scripts and their chunks
        for script_url in list(scripts_to_scan)[:10]:
            if script_url in seen_scripts:
                continue
            seen_scripts.add(script_url)

            s_res = engine.get(script_url)
            result.endpoints_tested += 1
            if not s_res.has_response or not s_res.body:
                continue

            body = s_res.body

            # Search for hardcoded secrets
            for p_name, pattern in SECRET_PATTERNS.items():
                m = pattern.search(body)
                if m:
                    match_snippet = m.group(0)
                    severity = "CRITICAL" if p_name in ("Stripe Secret Key", "Supabase Service Role Key", "RSA/Private SSH Key", "Ethereum / Blockchain Private Key") else "HIGH"
                    cvss_score = 9.1 if severity == "CRITICAL" else 7.5
                    confidence = ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Found pattern matching {p_name}")
                    finding = StandardFinding(
                        title=f"Hardcoded {p_name} in JavaScript Bundle",
                        description=f"Leaked {p_name} identified inside client-accessible script: {script_url}.",
                        severity=severity,
                        cwe="CWE-798",
                        owasp=self.owasp,
                        cvss=CVSSInfo(score=cvss_score, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N", severity=severity),
                        confidence=confidence,
                        remediation="Never commit private keys, service role keys, or secrets into client-side code. Store secrets server-side.",
                        evidence=[Evidence(
                            request=RequestEvidence(method="GET", url=script_url),
                            response=ResponseEvidence(status_code=s_res.status_code, headers=s_res.headers, body_snippet=safe_body_snippet(redact_sensitive(match_snippet)))
                        )]
                    )
                    result.findings.append(finding)
                    result.test_state = TestState.VULNERABLE

            # Also check for code-split chunks to scan
            chunk_names = set(JS_CHUNK_RE.findall(body))
            asset_base = script_url.rsplit('/', 1)[0] + '/'
            for chunk in list(chunk_names)[:15]:
                if chunk.startswith(('gtag', 'clarity')) or len(chunk) < 8:
                    continue
                c_url = urljoin(asset_base, chunk)
                if c_url not in seen_scripts and len(seen_scripts) < 25:
                    seen_scripts.add(c_url)
                    c_res = engine.get(c_url)
                    result.endpoints_tested += 1
                    if c_res.has_response and c_res.body:
                        for p_name, pattern in SECRET_PATTERNS.items():
                            cm = pattern.search(c_res.body)
                            if cm:
                                finding = StandardFinding(
                                    title=f"Hardcoded {p_name} in JavaScript Chunk",
                                    description=f"Leaked {p_name} in chunk bundle: {c_url}.",
                                    severity="HIGH",
                                    cwe="CWE-798",
                                    owasp=self.owasp,
                                    cvss=CVSSInfo(score=7.5, vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", severity="HIGH"),
                                    confidence=ConfidenceResult(ConfidenceLevel.CONFIRMED, f"Found {p_name} in chunk"),
                                    remediation="Rotate exposed credential immediately and remove from client bundle.",
                                    evidence=[Evidence(
                                        request=RequestEvidence(method="GET", url=c_url),
                                        response=ResponseEvidence(status_code=c_res.status_code, headers=c_res.headers, body_snippet=safe_body_snippet(redact_sensitive(cm.group(0))))
                                    )]
                                )
                                result.findings.append(finding)
                                result.test_state = TestState.VULNERABLE

        if result.findings:
            result.test_state = TestState.VULNERABLE
            result.details = f"Detected {len(result.findings)} sensitive data / configuration exposure issue(s)."
        else:
            result.details = f"Probed {result.endpoints_tested} paths & scripts: no exposed configuration files, .env, or private keys detected."

        return result
