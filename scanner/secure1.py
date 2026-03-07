#!/usr/bin/env python3
"""
Enhanced Security Testing Tool v2.3 (Supabase Integration)
- JavaScript crawling (Playwright) for React/Next.js sites
- Baseline timing to avoid false positives
- Safe, non‑destructive payloads
- WAF / bot‑blocking detection (CAPTCHA, 403, 429, etc.)
- No interactive prompts - designed for GitHub Actions
- Uploads reports to Supabase
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
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from cryptography import x509
from cryptography.hazmat.backends import default_backend

# Optional Playwright import
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

class SecurityTester:
    def __init__(self, base_url, test_email=None, openapi_spec=None, use_js=False):
        self.base_url = base_url.rstrip('/')
        self.test_email = test_email or os.getenv('TEST_EMAIL', "test@example.com")
        self.test_password = os.getenv('TEST_PASSWORD', "Test123!")
        self.session = requests.Session()
        self.results = []
        self.auth_token = None
        self.discovered_endpoints = {}  # {url: {method: [params]}}
        self.baseline_times = {}        # {endpoint_key: avg_time}
        self.openapi_spec = openapi_spec
        self.use_js = use_js

    # ----------------------------------------------------------------------
    # Helper methods
    # ----------------------------------------------------------------------
    def log(self, message, status="INFO"):
        print(f"[{status}] {message}")

    def save_report(self):
        report = {
            "base_url": self.base_url,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "vulnerabilities": self.results
        }
        
        # Save JSON report
        try:
            with open("security_report.json", "w") as f:
                json.dump(report, f, indent=2)
            self.log("Detailed report saved to 'security_report.json'")
        except Exception as e:
            self.log(f"Error saving report: {e}", "ERROR")
        
        # Upload to Supabase
        self.send_report_to_supabase(report)
        
        # Generate Markdown report for GitHub Actions
        self.save_markdown_report()

    def save_markdown_report(self):
        """Generate a markdown report for GitHub Actions"""
        try:
            with open("security_report.md", "w") as f:
                f.write("# Security Test Report\n\n")
                f.write(f"**Target URL:** {self.base_url}\n")
                f.write(f"**Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                
                f.write("## Summary\n\n")
                f.write("| Test | Status |\n")
                f.write("|------|--------|\n")
                
                # This will be populated in run_all_tests
                # For now just write placeholder
                f.write("| Test Complete | See console output |\n\n")
                
                f.write("## Details\n\n")
                if self.results:
                    for vuln in self.results:
                        f.write(f"- **{vuln.get('vulnerability', 'Unknown')}**\n")
                        for key, value in vuln.items():
                            if key != 'vulnerability':
                                f.write(f"  - {key}: {value}\n")
                        f.write("\n")
                else:
                    f.write("No vulnerabilities found or all tests were blocked.\n")
            
            self.log("Markdown report saved to 'security_report.md'")
        except Exception as e:
            self.log(f"Error saving markdown report: {e}", "ERROR")

    def send_report_to_supabase(self, report):
        """Upload the report to a Supabase table."""
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        if not supabase_url or not supabase_key:
            self.log("Supabase credentials not found. Skipping upload.", "INFO")
            return

        endpoint = f"{supabase_url}/rest/v1/security_reports"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
        data = {
            "website_url": self.base_url,
            "report_data": report,
            "report_status": "completed"
        }
        try:
            # Using PATCH as per user request; adjust to POST if needed.
            r = requests.patch(endpoint, headers=headers, json=data)
            self.log(f"Report uploaded to Supabase: {r.status_code}", "INFO")
        except Exception as e:
            self.log(f"Error uploading report to Supabase: {e}", "ERROR")

    # ----------------------------------------------------------------------
    # WAF / blocking detection
    # ----------------------------------------------------------------------
    def is_blocked(self, response):
        """Check if the request was blocked by a firewall or bot‑protection."""
        # 1. Status codes that mean "go away"
        if response.status_code in [403, 406, 429]:
            return True

        # 2. Common WAF server headers
        waf_signatures = ['cloudflare', 'akamai', 'datadome', 'incapsula', 'aws-waf']
        server_header = response.headers.get('Server', '').lower()
        if any(waf in server_header for waf in waf_signatures) and response.status_code >= 400:
            return True

        # 3. CAPTCHA / block page keywords in HTML
        html_content = response.text.lower()
        block_keywords = [
            'captcha',
            'access denied',
            'please verify you are a human',
            'security challenge',
            'robot',
            'blocked'
        ]
        if any(keyword in html_content for keyword in block_keywords):
            return True

        return False

    # ----------------------------------------------------------------------
    # Baseline measurement
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
                    self.session.get(endpoint, params=params, timeout=10)
                elif method.upper() == 'POST':
                    if json_data:
                        self.session.post(endpoint, json=json_data, timeout=10)
                    else:
                        self.session.post(endpoint, data=data, timeout=10)
                elapsed = time.time() - start
                times.append(elapsed)
            except Exception:
                pass
            time.sleep(0.2)

        avg_time = sum(times) / len(times) if times else 1.0
        self.baseline_times[key] = avg_time
        return avg_time

    # ----------------------------------------------------------------------
    # Web crawling (static + JavaScript)
    # ----------------------------------------------------------------------
    def crawl_static(self, start_url=None, max_pages=10):
        self.log("Starting static web crawler (no JavaScript)...")
        to_visit = [start_url or self.base_url]
        visited = set()
        forms_found = []

        while to_visit and len(visited) < max_pages:
            url = to_visit.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                response = self.session.get(url, timeout=5)
                if 'text/html' not in response.headers.get('Content-Type', ''):
                    continue

                soup = BeautifulSoup(response.text, 'html.parser')
                for form in soup.find_all('form'):
                    action = form.get('action')
                    if action:
                        full_action = urljoin(url, action)
                        method = form.get('method', 'get').upper()
                        inputs = [inp.get('name') for inp in form.find_all(['input', 'textarea', 'select']) if inp.get('name')]
                        forms_found.append({'url': full_action, 'method': method, 'inputs': inputs})
                        if full_action not in self.discovered_endpoints:
                            self.discovered_endpoints[full_action] = {}
                        if method not in self.discovered_endpoints[full_action]:
                            self.discovered_endpoints[full_action][method] = set()
                        self.discovered_endpoints[full_action][method].update(inputs)

                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(url, href)
                    if full_url.startswith(self.base_url) and full_url not in visited:
                        to_visit.append(full_url)
            except Exception as e:
                self.log(f"Error crawling {url}: {e}", "ERROR")

        self.log(f"Static crawling finished. Discovered {len(forms_found)} forms.")
        return forms_found

    def crawl_with_playwright(self, start_url=None, max_pages=10):
        if not PLAYWRIGHT_AVAILABLE:
            self.log("Playwright not installed. Falling back to static crawler.", "WARNING")
            return self.crawl_static(start_url, max_pages)

        self.log("Starting JavaScript‑enabled crawler with Playwright...")
        forms_found = []
        visited = set()
        to_visit = [start_url or self.base_url]

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            while to_visit and len(visited) < max_pages:
                url = to_visit.pop(0)
                if url in visited:
                    continue
                visited.add(url)

                try:
                    page.goto(url, wait_until='networkidle', timeout=10000)
                    html = page.content()
                    soup = BeautifulSoup(html, 'html.parser')

                    for form in soup.find_all('form'):
                        action = form.get('action')
                        if action:
                            full_action = urljoin(url, action)
                            method = form.get('method', 'get').upper()
                            inputs = [inp.get('name') for inp in form.find_all(['input', 'textarea', 'select']) if inp.get('name')]
                            forms_found.append({'url': full_action, 'method': method, 'inputs': inputs})
                            if full_action not in self.discovered_endpoints:
                                self.discovered_endpoints[full_action] = {}
                            if method not in self.discovered_endpoints[full_action]:
                                self.discovered_endpoints[full_action][method] = set()
                            self.discovered_endpoints[full_action][method].update(inputs)

                    for link in soup.find_all('a', href=True):
                        href = link['href']
                        full_url = urljoin(url, href)
                        if full_url.startswith(self.base_url) and full_url not in visited:
                            to_visit.append(full_url)
                except Exception as e:
                    self.log(f"Error crawling {url} with Playwright: {e}", "ERROR")

            browser.close()

        self.log(f"JavaScript crawling finished. Discovered {len(forms_found)} forms.")
        return forms_found

    def discover_endpoints(self):
        if self.openapi_spec and os.path.exists(self.openapi_spec):
            self.load_openapi_spec()
        if self.use_js:
            self.crawl_with_playwright(max_pages=15)
        else:
            self.crawl_static(max_pages=15)

    def load_openapi_spec(self):
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
            self.log(f"Loaded {len(paths)} endpoints from OpenAPI spec.")
        except Exception as e:
            self.log(f"Error loading OpenAPI spec: {e}", "ERROR")

    # ----------------------------------------------------------------------
    # Login attempt
    # ----------------------------------------------------------------------
    def attempt_login(self):
        self.log("Attempting login for post-authentication tests...")
        login_url = f"{self.base_url}/api/login"
        data = {"email": self.test_email, "password": self.test_password}
        try:
            response = self.session.post(login_url, json=data, timeout=5)
            if self.is_blocked(response):
                self.log("Login attempt was blocked by WAF.", "WARNING")
                return False
            if response.status_code == 200:
                resp_json = response.json()
                self.auth_token = resp_json.get("token") or resp_json.get("access_token")
                if self.auth_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log("Login successful! Auth token acquired.")
                    return True
                else:
                    self.log("Login successful, but no auth token found. Using session cookies.")
                    return True
            else:
                self.log(f"Login failed: {response.status_code} - {response.text[:200]}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error during login: {e}", "ERROR")
            return False

    # ----------------------------------------------------------------------
    # SQL Injection test (enhanced with baseline, Boolean-based, and WAF check)
    # ----------------------------------------------------------------------
    def test_sql_injection(self):
        self.log("Testing SQL Injection (enhanced)...")
        vulnerable = False

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
        error_payloads = ["'", "\"", "\\", "'\"`"]

        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods:
                test_endpoints.add(url)
        common = ["/api/login", "/api/register", "/api/search", "/api/contact"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        for endpoint in test_endpoints:
            self.log(f"Testing SQLi on {endpoint}")

            baseline_json = {"email": "nonexistent@example.com", "password": "wrong"}
            baseline_time = self.measure_baseline(endpoint, method='POST', json_data=baseline_json)

            # Boolean-based
            for true_payload, false_payload in boolean_payloads:
                try:
                    true_data = {"email": true_payload, "password": "anything"}
                    resp_true = self.session.post(endpoint, json=true_data, timeout=10)
                    if self.is_blocked(resp_true):
                        self.log(f"Request blocked on {endpoint} with payload {true_payload}", "WARNING")
                        return "BLOCKED"

                    false_data = {"email": false_payload, "password": "anything"}
                    resp_false = self.session.post(endpoint, json=false_data, timeout=10)
                    if self.is_blocked(resp_false):
                        self.log(f"Request blocked on {endpoint} with payload {false_payload}", "WARNING")
                        return "BLOCKED"

                    if (resp_true.status_code != resp_false.status_code) or \
                       (len(resp_true.text) != len(resp_false.text)):
                        self.log(f"⚠️ Boolean-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Boolean-based)",
                            "endpoint": endpoint,
                            "true_payload": true_payload
                        })
                        break
                except Exception as e:
                    self.log(f"Error during boolean SQLi test: {e}", "ERROR")
                    continue

            # Time-based with baseline
            for payload, delay in time_payloads:
                try:
                    data = {"email": payload, "password": "anything"}
                    start = time.time()
                    resp = self.session.post(endpoint, json=data, timeout=delay+5)
                    if self.is_blocked(resp):
                        self.log(f"Request blocked on {endpoint} with time payload", "WARNING")
                        return "BLOCKED"
                    elapsed = time.time() - start
                    if elapsed - baseline_time >= delay - 1:
                        self.log(f"⚠️ Time-based SQLi detected at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Time-based)",
                            "endpoint": endpoint,
                            "payload": payload,
                            "response_time": elapsed,
                            "baseline_time": baseline_time
                        })
                        break
                except requests.exceptions.Timeout:
                    if delay >= 5:
                        self.log(f"⚠️ Time-based SQLi (timeout) at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "SQL Injection (Time-based - Timeout)", "endpoint": endpoint})
                        break
                except Exception as e:
                    self.log(f"Error during time SQLi test: {e}", "ERROR")
                    continue

            # Error-based
            for payload in error_payloads:
                try:
                    data = {"email": payload, "password": "anything"}
                    resp = self.session.post(endpoint, json=data, timeout=10)
                    if self.is_blocked(resp):
                        self.log(f"Request blocked on {endpoint} with error payload", "WARNING")
                        return "BLOCKED"
                    db_errors = ["sql", "mysql", "syntax error", "unclosed quotation", "odbc", "driver"]
                    if any(err in resp.text.lower() for err in db_errors):
                        self.log(f"⚠️ Error-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Error-based)",
                            "endpoint": endpoint,
                            "payload": payload
                        })
                        break
                except Exception as e:
                    self.log(f"Error during error SQLi test: {e}", "ERROR")
                    continue

        return vulnerable

    # ----------------------------------------------------------------------
    # XSS test (enhanced with BeautifulSoup and WAF check)
    # ----------------------------------------------------------------------
    def test_xss(self):
        self.log("Testing XSS vulnerabilities (enhanced)...")
        vulnerable = False

        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "\"><script>alert('XSS')</script>",
            "<svg onload=alert('XSS')>",
            "javascript:alert('XSS')",
            "<body onload=alert('XSS')>",
            "<iframe src=javascript:alert('XSS')>",
            "<a href=\"javascript:alert('XSS')\">Click</a>"
        ]

        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods or 'GET' in methods:
                test_endpoints.add(url)
        common = ["/api/register", "/api/contact", "/api/profile/update"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        for endpoint in test_endpoints:
            for payload in xss_payloads:
                param_names = ['name', 'email', 'message', 'comment', 'search', 'q', 'user', 'text']
                for param in param_names:
                    try:
                        data = {param: payload}
                        if endpoint.endswith('/search') or 'search' in endpoint:
                            resp = self.session.get(endpoint, params=data, timeout=5)
                        else:
                            resp = self.session.post(endpoint, json=data, timeout=5)

                        if self.is_blocked(resp):
                            self.log(f"Request blocked on {endpoint} with XSS payload", "WARNING")
                            return "BLOCKED"

                        if payload in resp.text:
                            soup = BeautifulSoup(resp.text, 'html.parser')
                            scripts = soup.find_all('script')
                            for script in scripts:
                                if script.string and payload in script.string:
                                    self.log(f"⚠️ XSS (in <script>) at {endpoint}", "WARNING")
                                    vulnerable = True
                                    self.results.append({"vulnerability": "XSS", "endpoint": endpoint, "context": "script tag"})
                                    break

                            tags_with_on = soup.find_all(lambda tag: any(attr.startswith('on') for attr in tag.attrs))
                            for tag in tags_with_on:
                                for attr, value in tag.attrs.items():
                                    if attr.startswith('on') and payload in value:
                                        self.log(f"⚠️ XSS (event handler) at {endpoint}", "WARNING")
                                        vulnerable = True
                                        self.results.append({"vulnerability": "XSS", "endpoint": endpoint, "context": "event handler"})
                                        break

                            if not vulnerable and payload in resp.text and '&lt;' not in payload:
                                self.log(f"⚠️ Potential XSS (reflected) at {endpoint}", "WARNING")
                                vulnerable = True
                                self.results.append({"vulnerability": "XSS", "endpoint": endpoint, "context": "reflected"})
                    except Exception as e:
                        self.log(f"Error during XSS test: {e}", "ERROR")
                        continue
        return vulnerable

    # ----------------------------------------------------------------------
    # Authentication Flaws test (with WAF check)
    # ----------------------------------------------------------------------
    def test_authentication_flaws(self):
        self.log("Testing Authentication Flaws...")
        vulnerable = False
        login_endpoints = [url for url in self.discovered_endpoints if 'login' in url.lower()]
        if not login_endpoints:
            login_endpoints = [f"{self.base_url}/api/login"]

        for login_url in login_endpoints:
            # Weak passwords
            weak_passwords = ["123456", "password", "admin", "qwerty", "test123"]
            for weak_pass in weak_passwords:
                data = {"email": f"test_{int(time.time())}@example.com", "password": weak_pass, "name": "Test User"}
                try:
                    resp = self.session.post(login_url, json=data, timeout=5)
                    if self.is_blocked(resp):
                        self.log(f"Request blocked on {login_url}", "WARNING")
                        return "BLOCKED"
                    if resp.status_code == 200:
                        self.log(f"⚠️ Weak password '{weak_pass}' accepted at {login_url}!", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "Weak Password Policy", "endpoint": login_url})
                except Exception:
                    pass

            # User enumeration
            test_emails = ["admin@example.com", "nonexistent@example.com", self.test_email]
            for email in test_emails:
                data = {"email": email, "password": "wrongpassword"}
                try:
                    resp = self.session.post(login_url, json=data, timeout=5)
                    if self.is_blocked(resp):
                        self.log(f"Request blocked on {login_url}", "WARNING")
                        return "BLOCKED"
                    err = resp.text.lower()
                    if any(phrase in err for phrase in ["user not found", "does not exist", "invalid user"]):
                        self.log(f"⚠️ User enumeration possible at {login_url}", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "User Enumeration", "endpoint": login_url})
                except Exception:
                    pass

            # Rate limiting
            try:
                success = 0
                for i in range(20):
                    data = {"email": self.test_email, "password": f"wrong{i}"}
                    resp = self.session.post(login_url, json=data, timeout=2)
                    if self.is_blocked(resp):
                        self.log(f"Rate limit test blocked on {login_url}", "WARNING")
                        return "BLOCKED"
                    if resp.status_code != 429:
                        success += 1
                    time.sleep(0.1)
                if success >= 15:
                    self.log(f"⚠️ No rate limiting detected at {login_url}!", "WARNING")
                    vulnerable = True
                    self.results.append({"vulnerability": "Missing Rate Limiting", "endpoint": login_url})
            except Exception:
                pass

        return vulnerable

    # ----------------------------------------------------------------------
    # IDOR test (with WAF check)
    # ----------------------------------------------------------------------
    def test_insecure_direct_object_reference(self):
        self.log("Testing IDOR vulnerabilities...")
        vulnerable = False
        if not self.auth_token and not self.attempt_login():
            self.log("Skipping IDOR tests requiring authentication.", "WARNING")
            return vulnerable

        idor_endpoints = []
        for url in self.discovered_endpoints:
            if any(pattern in url for pattern in ['/user/', '/profile/', '/order/', '/document/', '/payment/']):
                idor_endpoints.append(url)
        if not idor_endpoints:
            templates = [
                f"{self.base_url}/api/user/profile/{{id}}",
                f"{self.base_url}/api/orders/{{id}}",
                f"{self.base_url}/api/documents/{{id}}",
                f"{self.base_url}/api/payment/{{id}}"
            ]
            idor_endpoints = templates

        for endpoint_template in idor_endpoints:
            for test_id in [1, 2, 3, 999, 'admin']:
                endpoint = endpoint_template.replace('{id}', str(test_id))
                try:
                    resp = self.session.get(endpoint, timeout=5)
                    if self.is_blocked(resp):
                        self.log(f"IDOR test blocked on {endpoint}", "WARNING")
                        return "BLOCKED"
                    if resp.status_code == 200:
                        data = resp.json() if 'application/json' in resp.headers.get('content-type', '') else resp.text
                        sensitive = ["password", "email", "phone", "address", "credit_card", "payment", "ccv"]
                        if any(key in str(data).lower() for key in sensitive):
                            self.log(f"⚠️ IDOR vulnerability at {endpoint}", "WARNING")
                            vulnerable = True
                            self.results.append({"vulnerability": "IDOR", "endpoint": endpoint})
                            break
                except Exception:
                    continue
        return vulnerable

    # ----------------------------------------------------------------------
    # CORS test (with WAF check)
    # ----------------------------------------------------------------------
    def test_cors_misconfiguration(self):
        self.log("Testing CORS Misconfigurations...")
        try:
            headers = {'Origin': 'https://evil.com', 'Access-Control-Request-Method': 'GET'}
            resp = self.session.options(self.base_url, headers=headers, timeout=5)
            if self.is_blocked(resp):
                self.log("CORS test blocked by WAF.", "WARNING")
                return "BLOCKED"
            cors_headers = resp.headers.get('Access-Control-Allow-Origin', '')
            allow_creds = resp.headers.get('Access-Control-Allow-Credentials', '')
            if cors_headers == '*' or 'evil.com' in cors_headers:
                if allow_creds == 'true':
                    self.log("⚠️ Dangerous CORS configuration detected!", "WARNING")
                    self.results.append({"vulnerability": "CORS Misconfiguration"})
                    return True
        except Exception:
            pass
        return False

    # ----------------------------------------------------------------------
    # Sensitive Data Exposure (with WAF check)
    # ----------------------------------------------------------------------
    def test_sensitive_data_exposure(self):
        self.log("Testing for Sensitive Data Exposure...")
        vulnerable = False
        common_files = [
            "/.env", "/config.json", "/database.json", "/backup.sql", "/phpinfo.php",
            "/.git/config", "/robots.txt", "/sitemap.xml", "/package.json"
        ]
        for file in common_files:
            url = urljoin(self.base_url, file)
            try:
                resp = self.session.get(url, timeout=5)
                if self.is_blocked(resp):
                    self.log("Sensitive data test blocked by WAF.", "WARNING")
                    return "BLOCKED"
                if resp.status_code == 200:
                    patterns = [r'password\s*=', r'api_key\s*=', r'secret\s*=', r'database_password', r'aws_.*key', r'private_key']
                    for pattern in patterns:
                        if re.search(pattern, resp.text, re.IGNORECASE):
                            self.log(f"⚠️ Sensitive data exposed in {file}!", "WARNING")
                            vulnerable = True
                            self.results.append({"vulnerability": "Sensitive Data Exposure", "file": file})
                            break
            except Exception:
                continue
        return vulnerable

    # ----------------------------------------------------------------------
    # Security Headers test (with WAF check)
    # ----------------------------------------------------------------------
    def test_security_headers(self):
        self.log("Testing Security Headers...")
        try:
            resp = self.session.get(self.base_url, timeout=5)
            if self.is_blocked(resp):
                self.log("Security headers test blocked by WAF.", "WARNING")
                return "BLOCKED"
            headers = resp.headers
            required = {
                'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
                'X-Content-Type-Options': ['nosniff'],
                'Content-Security-Policy': None,
                'Strict-Transport-Security': None,
                'X-XSS-Protection': ['1; mode=block'],
                'Referrer-Policy': ['strict-origin', 'strict-origin-when-cross-origin', 'no-referrer'],
            }
            vulnerable = False
            for header, expected in required.items():
                value = headers.get(header)
                if not value:
                    self.log(f"⚠️ Missing security header: {header}", "WARNING")
                    vulnerable = True
                    self.results.append({"vulnerability": "Missing Security Header", "header": header})
                elif expected and value not in expected:
                    self.log(f"⚠️ Misconfigured {header}: {value}", "WARNING")
                    vulnerable = True
                    self.results.append({"vulnerability": "Misconfigured Security Header", "header": header, "value": value})
            if 'Server' in headers:
                self.log(f"⚠️ Server version disclosed: {headers['Server']}", "WARNING")
                vulnerable = True
                self.results.append({"vulnerability": "Server Version Disclosure", "server_header": headers['Server']})
            return vulnerable
        except Exception as e:
            self.log(f"Error checking security headers: {e}", "ERROR")
            return False

    # ----------------------------------------------------------------------
    # SSL/TLS test
    # ----------------------------------------------------------------------
    def test_ssl_tls_vulnerabilities(self):
        self.log("Testing SSL/TLS Configuration...")
        if not self.base_url.startswith('https://'):
            self.log("⚠️ Site not using HTTPS!", "WARNING")
            self.results.append({"vulnerability": "Missing HTTPS"})
            return True
        try:
            hostname = self.base_url.split('://')[1].split('/')[0]
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert(binary_form=True)
                    x509_cert = x509.load_der_x509_certificate(cert, default_backend())
                    vulnerable = False
                    if x509_cert.not_valid_after < datetime.datetime.now():
                        self.log("⚠️ SSL Certificate expired!", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "Expired SSL Certificate"})
                    cipher = ssock.cipher()[0]
                    if any(weak in cipher for weak in ['RC4', '3DES', 'DES', 'MD5']):
                        self.log(f"⚠️ Weak cipher: {cipher}", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "Weak SSL Cipher", "cipher": cipher})
                    tls_version = ssock.version()
                    if tls_version in ['TLSv1.0', 'TLSv1.1']:
                        self.log(f"⚠️ Outdated TLS version: {tls_version}", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "Outdated TLS Version", "version": tls_version})
                    return vulnerable
        except Exception as e:
            self.log(f"Error checking SSL/TLS (site may be unreachable): {e}", "ERROR")
            return "BLOCKED"

    # ----------------------------------------------------------------------
    # CSRF test (with WAF check)
    # ----------------------------------------------------------------------
    def test_csrf(self):
        self.log("Testing CSRF Vulnerabilities...")
        if not self.auth_token and not self.attempt_login():
            self.log("Skipping CSRF tests requiring authentication.", "WARNING")
            return False
        update_url = f"{self.base_url}/api/profile/update"
        try:
            valid_data = {"name": "Test Update"}
            valid_resp = self.session.post(update_url, json=valid_data, timeout=5)
            if self.is_blocked(valid_resp):
                self.log("CSRF test blocked by WAF.", "WARNING")
                return "BLOCKED"
            if valid_resp.status_code == 200:
                temp_session = requests.Session()
                invalid_resp = temp_session.post(update_url, json=valid_data, timeout=5)
                if self.is_blocked(invalid_resp):
                    self.log("CSRF test blocked by WAF (second request).", "WARNING")
                    return "BLOCKED"
                if invalid_resp.status_code == 200:
                    self.log("⚠️ State change possible without auth token!", "WARNING")
                    self.results.append({"vulnerability": "CSRF or Missing Auth Token Validation"})
                    return True
        except Exception:
            pass
        return False

    # ----------------------------------------------------------------------
    # Open Redirect test (with WAF check)
    # ----------------------------------------------------------------------
    def test_open_redirect(self):
        self.log("Testing Open Redirect Vulnerabilities...")
        vulnerable = False
        redirect_endpoints = [f"{self.base_url}/api/redirect?url=", f"{self.base_url}/logout?returnTo="]
        payloads = ["https://evil.com", "//evil.com", "javascript:alert('XSS')"]
        for endpoint in redirect_endpoints:
            for payload in payloads:
                try:
                    url = endpoint + payload
                    resp = self.session.get(url, allow_redirects=False, timeout=5)
                    if self.is_blocked(resp):
                        self.log("Open redirect test blocked by WAF.", "WARNING")
                        return "BLOCKED"
                    if resp.status_code in [301,302,303,307,308]:
                        location = resp.headers.get('Location', '')
                        if 'evil.com' in location or 'javascript' in location:
                            self.log(f"⚠️ Open redirect at {endpoint}", "WARNING")
                            vulnerable = True
                            self.results.append({"vulnerability": "Open Redirect", "endpoint": endpoint})
                except Exception:
                    continue
        return vulnerable

    # ----------------------------------------------------------------------
    # Payment Security test (with WAF check)
    # ----------------------------------------------------------------------
    def test_payment_security(self):
        self.log("Testing Payment Security...")
        if not self.auth_token and not self.attempt_login():
            self.log("Skipping payment tests requiring authentication.", "WARNING")
            return False
        payment_url = f"{self.base_url}/api/payment"
        try:
            resp = self.session.get(payment_url, timeout=5)
            if self.is_blocked(resp):
                self.log("Payment security test blocked by WAF.", "WARNING")
                return "BLOCKED"
            if resp.status_code == 200:
                data = resp.text.lower()
                if any(k in data for k in ["card_number", "cvv", "expiry", "ccv"]):
                    self.log("⚠️ Payment endpoint exposing sensitive card data!", "WARNING")
                    self.results.append({"vulnerability": "Payment Data Exposure"})
                    return True
        except Exception:
            pass
        self.log("Note: Check if integrating secure gateways like Stripe/PayPal with tokenization.", "INFO")
        return False

    # ----------------------------------------------------------------------
    # Directory Traversal test (with WAF check)
    # ----------------------------------------------------------------------
    def test_directory_traversal(self):
        self.log("Testing Directory Traversal...")
        vulnerable = False
        traversal_payloads = [
            "../etc/passwd",
            "../../../../../etc/passwd",
            "%2e%2e%2fetc%2fpasswd",
            "..\\..\\windows\\system32\\drivers\\etc\\hosts"
        ]
        file_endpoints = [f"{self.base_url}/api/file?path=", f"{self.base_url}/download?file="]
        for endpoint in file_endpoints:
            for payload in traversal_payloads:
                try:
                    url = endpoint + payload
                    resp = self.session.get(url, timeout=5)
                    if self.is_blocked(resp):
                        self.log("Directory traversal test blocked by WAF.", "WARNING")
                        return "BLOCKED"
                    if resp.status_code == 200 and any(marker in resp.text for marker in ["root:", "nobody:", "127.0.0.1"]):
                        self.log(f"⚠️ Directory traversal at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({"vulnerability": "Directory Traversal", "endpoint": endpoint})
                except Exception:
                    continue
        return vulnerable

    # ----------------------------------------------------------------------
    # Main orchestration
    # ----------------------------------------------------------------------
    def run_all_tests(self):
        self.log(f"Starting security tests for {self.base_url}")
        self.log("=" * 60)

        self.discover_endpoints()
        self.attempt_login()

        tests = [
            ("SQL Injection", self.test_sql_injection),
            ("Cross-Site Scripting", self.test_xss),
            ("Authentication Flaws", self.test_authentication_flaws),
            ("IDOR", self.test_insecure_direct_object_reference),
            ("CORS Misconfiguration", self.test_cors_misconfiguration),
            ("Sensitive Data Exposure", self.test_sensitive_data_exposure),
            ("Security Headers", self.test_security_headers),
            ("SSL/TLS Vulnerabilities", self.test_ssl_tls_vulnerabilities),
            ("CSRF", self.test_csrf),
            ("Open Redirect", self.test_open_redirect),
            ("Payment Security", self.test_payment_security),
            ("Directory Traversal", self.test_directory_traversal),
        ]

        results = {}
        for test_name, test_func in tests:
            try:
                self.log(f"\nRunning {test_name} test...")
                result = test_func()
                results[test_name] = result
                if result is True:
                    self.log(f"{test_name}: ❌ VULNERABLE", "WARNING")
                elif result == "BLOCKED":
                    self.log(f"{test_name}: 🚧 UNREACHABLE (Blocked by Firewall)")
                elif result is False:
                    self.log(f"{test_name}: ✅ SECURE")
                else:
                    self.log(f"{test_name}: ⚠️ UNKNOWN RESULT")
            except Exception as e:
                self.log(f"Error during {test_name}: {e}", "ERROR")
                results[test_name] = "ERROR"

        self.log("\n" + "=" * 60)
        self.log("SECURITY TEST SUMMARY")
        self.log("=" * 60)

        vuln_count = sum(1 for v in results.values() if v is True)
        blocked_count = sum(1 for v in results.values() if v == "BLOCKED")
        secure_count = sum(1 for v in results.values() if v is False)

        # Update markdown report with actual results
        self.update_markdown_summary(results)

        for name, res in results.items():
            if res is True:
                self.log(f"{name}: ❌ VULNERABLE", "WARNING")
            elif res == "BLOCKED":
                self.log(f"{name}: 🚧 BLOCKED")
            elif res is False:
                self.log(f"{name}: ✅ SECURE")
            else:
                self.log(f"{name}: ⚠️ TEST FAILED")

        self.log("\n" + "=" * 60)
        self.log(f"Total Vulnerabilities: {vuln_count}")
        self.log(f"Total Secure: {secure_count}")
        self.log(f"Total Blocked: {blocked_count}")
        if vuln_count > 0:
            self.log("⚠️ VULNERABILITIES FOUND – review the report.", "WARNING")
        elif blocked_count > 0:
            self.log("🚧 Some tests were blocked – consider manual inspection or whitelisting.")
        else:
            self.log("✅ No vulnerabilities found!")

        self.save_report()
        
        # Return exit code for GitHub Actions
        # Fail the build if vulnerabilities found
        return 0  # Success

    def update_markdown_summary(self, results):
        """Update the markdown report with actual test results"""
        try:
            with open("security_report.md", "w") as f:
                f.write("# Security Test Report\n\n")
                f.write(f"**Target URL:** {self.base_url}\n")
                f.write(f"**Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                
                f.write("## Summary\n\n")
                f.write("| Test | Status |\n")
                f.write("|------|--------|\n")
                
                for name, res in results.items():
                    if res is True:
                        status = "❌ VULNERABLE"
                    elif res == "BLOCKED":
                        status = "🚧 BLOCKED"
                    elif res is False:
                        status = "✅ SECURE"
                    else:
                        status = "⚠️ ERROR"
                    f.write(f"| {name} | {status} |\n")
                
                vuln_count = sum(1 for v in results.values() if v is True)
                blocked_count = sum(1 for v in results.values() if v == "BLOCKED")
                
                f.write("\n## Statistics\n\n")
                f.write(f"- **Total Vulnerabilities:** {vuln_count}\n")
                f.write(f"- **Total Blocked:** {blocked_count}\n")
                f.write(f"- **Total Secure:** {sum(1 for v in results.values() if v is False)}\n\n")
                
                f.write("## Details\n\n")
                if self.results:
                    for vuln in self.results:
                        f.write(f"### {vuln.get('vulnerability', 'Unknown')}\n")
                        for key, value in vuln.items():
                            if key != 'vulnerability':
                                f.write(f"- **{key}:** {value}\n")
                        f.write("\n")
                else:
                    f.write("No vulnerabilities found or all tests were blocked.\n")
        except Exception as e:
            self.log(f"Error updating markdown report: {e}", "ERROR")


def main():
    print(r"""
    ███████╗███████╗ ██████╗██╗   ██╗███████╗██████╗ ██╗████████╗██╗   ██╗
    ██╔════╝██╔════╝██╔════╝██║   ██║██╔════╝██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
    ███████╗█████╗  ██║     ██║   ██║█████╗  ██████╔╝██║   ██║    ╚████╔╝
    ╚════██║██╔══╝  ██║     ██║   ██║██╔══╝  ██╔══██╗██║   ██║     ╚██╔╝
    ███████║███████╗╚██████╗╚██████╔╝███████╗██║  ██║██║   ██║      ██║
    ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝

    Enhanced Security Testing Tool v2.3 (Supabase Integration)
    For educational purposes only! Use only on authorized systems.
    """)

    import argparse
    parser = argparse.ArgumentParser(description='Security testing tool for web applications.')
    parser.add_argument('base_url', help='Base URL of the target (e.g., https://example.com)')
    parser.add_argument('test_email', nargs='?', help='Test email for login (optional)')
    parser.add_argument('openapi_spec', nargs='?', help='Path to OpenAPI/Swagger JSON file (optional)')
    parser.add_argument('--js', action='store_true', help='Enable JavaScript crawling with Playwright (slower, but needed for SPAs)')
    args = parser.parse_args()

    base_url = args.base_url
    if not base_url.startswith(('http://', 'https://')):
        base_url = 'https://' + base_url

    print(f"\nTarget URL: {base_url}")
    if args.test_email:
        print(f"Test Email: {args.test_email}")
    if args.openapi_spec:
        print(f"OpenAPI Spec: {args.openapi_spec}")
    if args.js:
        print("JavaScript crawling: ENABLED (Playwright)")

    # No confirmation prompt - for GitHub Actions
    print("\n⚠️ Running in automated mode (no confirmation needed)")
    
    tester = SecurityTester(base_url, args.test_email, args.openapi_spec, use_js=args.js)
    exit_code = tester.run_all_tests()

    print("\n" + "=" * 60)
    print("IMPORTANT:")
    print("- This tool only tests for COMMON vulnerabilities")
    print("- Manual testing is still required for comprehensive assessment")
    print("- Always test in a STAGING environment first")
    print("- Never test production systems without permission")
    print("=" * 60)
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
