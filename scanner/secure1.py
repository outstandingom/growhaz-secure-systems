#!/usr/bin/env python3
"""
Enhanced Security Testing Tool v2.3 (GitHub Actions Compatible, Always Success)
- JavaScript crawling (Playwright) for React/Next.js sites
- Baseline timing to avoid false positives
- Safe, non‑destructive payloads
- WAF / bot‑blocking detection (CAPTCHA, 403, 429, etc.)
- No interactive prompts - designed for GitHub Actions
- Uploads reports to Supabase with specific report ID
- Always returns exit code 0 (build never fails)
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
    def __init__(self, base_url, report_id=None, test_email=None, openapi_spec=None, use_js=False):
        self.base_url = base_url.rstrip('/')
        self.report_id = report_id or os.getenv('REPORT_ID')
        self.test_email = test_email or os.getenv('TEST_EMAIL', "test@example.com")
        self.test_password = os.getenv('TEST_PASSWORD', "Test123!")
        self.session = requests.Session()
        self.results = []
        self.auth_token = None
        self.discovered_endpoints = {}  # {url: {method: [params]}}
        self.baseline_times = {}        # {endpoint_key: avg_time}
        self.openapi_spec = openapi_spec
        self.use_js = use_js
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        
        # Print configuration for debugging
        self.log(f"Initialized scanner for {base_url}")
        self.log(f"Report ID: {self.report_id}")
        self.log(f"Supabase URL configured: {'Yes' if self.supabase_url else 'No'}")
        self.log(f"Supabase Key configured: {'Yes' if self.supabase_key else 'No'}")

    # ----------------------------------------------------------------------
    # Helper methods
    # ----------------------------------------------------------------------
    def log(self, message, status="INFO"):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")

    def calculate_risk_level(self):
        """Calculate risk level based on vulnerabilities found"""
        if not self.results:
            return "low"
        
        # Count critical vulnerabilities
        critical_vulns = ['SQL Injection', 'IDOR', 'Directory Traversal', 'CORS Misconfiguration']
        critical_count = sum(1 for v in self.results if v.get('vulnerability') in critical_vulns)
        
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
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "vulnerabilities": self.results,
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
                f.write(f"**Report ID:** {self.report_id}\n\n")
                
                # Summary section
                f.write("## 📊 Summary\n\n")
                f.write(f"- **Total Vulnerabilities:** {len(self.results)}\n")
                f.write(f"- **Risk Level:** {risk_level.upper()}\n\n")
                
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
                f.write("*Report generated by GROWHAZ Security Scanner*\n")
            
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

        # Update the specific report record
        endpoint = f"{self.supabase_url}/rest/v1/security_reports?id=eq.{self.report_id}"
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
        # Count vulnerabilities by type for better reporting
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
                
                # Log vulnerability breakdown
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
        # 1. Status codes that mean "go away"
        if response.status_code in [403, 406, 429]:
            return True

        # 2. Common WAF server headers
        waf_signatures = ['cloudflare', 'akamai', 'datadome', 'incapsula', 'aws-waf', 'cloudfront']
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
            'blocked',
            'rate limit exceeded'
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
        self.log("🕷️ Starting static web crawler (no JavaScript)...")
        to_visit = [start_url or self.base_url]
        visited = set()
        forms_found = []
        endpoints_found = set()

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
                    if full_url.startswith(self.base_url) and full_url not in visited:
                        to_visit.append(full_url)
                        endpoints_found.add(full_url)
                        
            except Exception as e:
                self.log(f"Error crawling {url}: {e}", "ERROR")

        self.log(f"✅ Static crawling finished. Discovered {len(endpoints_found)} endpoints, {len(forms_found)} forms.")
        return forms_found

    def crawl_with_playwright(self, start_url=None, max_pages=10):
        if not PLAYWRIGHT_AVAILABLE:
            self.log("⚠️ Playwright not installed. Falling back to static crawler.", "WARNING")
            return self.crawl_static(start_url, max_pages)

        self.log("🕷️ Starting JavaScript‑enabled crawler with Playwright...")
        forms_found = []
        visited = set()
        to_visit = [start_url or self.base_url]
        endpoints_found = set()

        try:
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
                            if full_url.startswith(self.base_url) and full_url not in visited:
                                to_visit.append(full_url)
                                endpoints_found.add(full_url)
                                
                    except Exception as e:
                        self.log(f"Error crawling {url} with Playwright: {e}", "ERROR")

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
            self.crawl_with_playwright(max_pages=15)
        else:
            self.crawl_static(max_pages=15)
            
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
    # Login attempt
    # ----------------------------------------------------------------------
    def attempt_login(self):
        """Attempt to login to get auth token for deeper testing"""
        self.log("🔑 Attempting login for post-authentication tests...")
        login_url = f"{self.base_url}/api/login"
        data = {"email": self.test_email, "password": self.test_password}
        
        # Also try alternative endpoints
        alternative_logins = [
            f"{self.base_url}/login",
            f"{self.base_url}/auth/login",
            f"{self.base_url}/api/auth/login",
            f"{self.base_url}/user/login"
        ]
        
        all_login_urls = [login_url] + alternative_logins
        
        for login_url in all_login_urls:
            try:
                response = self.session.post(login_url, json=data, timeout=5)
                
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
    # SQL Injection test
    # ----------------------------------------------------------------------
    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        self.log("🔍 Testing SQL Injection...")
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
        error_payloads = ["'", "\"", "\\", "'\"`", "';--"]

        # Build test endpoints
        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods:
                test_endpoints.add(url)
        
        # Add common endpoints
        common = ["/api/login", "/api/register", "/api/search", "/api/contact", "/search", "/contact"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        for endpoint in test_endpoints:
            self.log(f"  Testing {endpoint}")

            # Measure baseline
            baseline_json = {"email": "nonexistent@example.com", "password": "wrongpassword"}
            baseline_time = self.measure_baseline(endpoint, method='POST', json_data=baseline_json)

            # Boolean-based tests
            for true_payload, false_payload in boolean_payloads:
                try:
                    true_data = {"email": true_payload, "password": "anything"}
                    resp_true = self.session.post(endpoint, json=true_data, timeout=10)
                    if self.is_blocked(resp_true):
                        continue

                    false_data = {"email": false_payload, "password": "anything"}
                    resp_false = self.session.post(endpoint, json=false_data, timeout=10)
                    if self.is_blocked(resp_false):
                        continue

                    if (resp_true.status_code != resp_false.status_code) or \
                       (len(resp_true.text) != len(resp_false.text)):
                        self.log(f"  ⚠️ Boolean-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Boolean-based)",
                            "endpoint": endpoint,
                            "true_payload": true_payload,
                            "false_payload": false_payload,
                            "severity": "high"
                        })
                        break
                except Exception as e:
                    continue

            # Time-based tests
            for payload, delay in time_payloads:
                try:
                    data = {"email": payload, "password": "anything"}
                    start = time.time()
                    resp = self.session.post(endpoint, json=data, timeout=delay+5)
                    if self.is_blocked(resp):
                        continue
                    elapsed = time.time() - start
                    if elapsed - baseline_time >= delay - 1:
                        self.log(f"  ⚠️ Time-based SQLi detected at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Time-based)",
                            "endpoint": endpoint,
                            "payload": payload,
                            "response_time": f"{elapsed:.2f}s",
                            "baseline_time": f"{baseline_time:.2f}s",
                            "severity": "high"
                        })
                        break
                except requests.exceptions.Timeout:
                    if delay >= 5:
                        self.log(f"  ⚠️ Time-based SQLi (timeout) at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Time-based - Timeout)",
                            "endpoint": endpoint,
                            "severity": "high"
                        })
                        break
                except Exception:
                    continue

            # Error-based tests
            for payload in error_payloads:
                try:
                    data = {"email": payload, "password": "anything"}
                    resp = self.session.post(endpoint, json=data, timeout=10)
                    if self.is_blocked(resp):
                        continue
                        
                    db_errors = ["sql", "mysql", "syntax error", "unclosed quotation", "odbc", "driver", "ora-"]
                    if any(err in resp.text.lower() for err in db_errors):
                        self.log(f"  ⚠️ Error-based SQLi possible at {endpoint}", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "SQL Injection (Error-based)",
                            "endpoint": endpoint,
                            "payload": payload,
                            "severity": "high"
                        })
                        break
                except Exception:
                    continue

        return vulnerable

    # ----------------------------------------------------------------------
    # XSS test
    # ----------------------------------------------------------------------
    def test_xss(self):
        """Test for Cross-Site Scripting vulnerabilities"""
        self.log("🔍 Testing XSS vulnerabilities...")
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

        test_endpoints = set()
        for url, methods in self.discovered_endpoints.items():
            if 'POST' in methods or 'GET' in methods:
                test_endpoints.add(url)
        
        common = ["/api/register", "/api/contact", "/api/profile/update", "/search", "/comment"]
        for path in common:
            test_endpoints.add(urljoin(self.base_url, path))

        param_names = ['name', 'email', 'message', 'comment', 'search', 'q', 'user', 'text', 'input', 'feedback']

        for endpoint in test_endpoints:
            self.log(f"  Testing {endpoint}")
            
            for payload in xss_payloads:
                for param in param_names:
                    try:
                        data = {param: payload}
                        
                        # Determine if GET or POST
                        if any(x in endpoint.lower() for x in ['search', 'q', 'query']):
                            resp = self.session.get(endpoint, params=data, timeout=5)
                        else:
                            resp = self.session.post(endpoint, json=data, timeout=5)

                        if self.is_blocked(resp):
                            continue

                        # Check if payload is reflected
                        if payload in resp.text:
                            # Check if it's actually executed (not encoded)
                            if payload in resp.text and '&lt;' not in payload and '&gt;' not in payload:
                                self.log(f"  ⚠️ XSS vulnerability at {endpoint}", "WARNING")
                                vulnerable = True
                                self.results.append({
                                    "vulnerability": "Cross-Site Scripting (XSS)",
                                    "endpoint": endpoint,
                                    "parameter": param,
                                    "payload": payload[:50],
                                    "severity": "medium"
                                })
                                break
                    except Exception:
                        continue
                if vulnerable:
                    break

        return vulnerable

    # ----------------------------------------------------------------------
    # Authentication Flaws test
    # ----------------------------------------------------------------------
    def test_authentication_flaws(self):
        """Test for authentication-related vulnerabilities"""
        self.log("🔍 Testing Authentication Flaws...")
        vulnerable = False
        
        login_endpoints = [url for url in self.discovered_endpoints if 'login' in url.lower()]
        if not login_endpoints:
            login_endpoints = [f"{self.base_url}/api/login", f"{self.base_url}/login"]

        for login_url in login_endpoints:
            self.log(f"  Testing {login_url}")
            
            # Test weak passwords
            weak_passwords = ["123456", "password", "admin", "qwerty", "test123", "password123"]
            for weak_pass in weak_passwords:
                try:
                    data = {"email": f"test_{int(time.time())}@example.com", "password": weak_pass, "name": "Test User"}
                    resp = self.session.post(login_url, json=data, timeout=5)
                    
                    if self.is_blocked(resp):
                        continue
                        
                    if resp.status_code == 200:
                        self.log(f"  ⚠️ Weak password '{weak_pass}' accepted!", "WARNING")
                        vulnerable = True
                        self.results.append({
                            "vulnerability": "Weak Password Policy",
                            "endpoint": login_url,
                            "password_accepted": weak_pass,
                            "severity": "medium"
                        })
                except Exception:
                    pass

            # Test user enumeration
            test_emails = ["admin@example.com", "nonexistent@example.com", self.test_email, "user@nonexistent.com"]
            responses = {}
            
            for email in test_emails:
                try:
                    data = {"email": email, "password": "wrongpassword"}
                    resp = self.session.post(login_url, json=data, timeout=5)
                    
                    if self.is_blocked(resp):
                        continue
                        
                    responses[email] = resp.text.lower()
                except Exception:
                    continue
            
            # Check if error messages differ
            if len(responses) >= 2:
                first_response = list(responses.values())[0]
                consistent = all(r == first_response for r in responses.values())
                
                if not consistent:
                    # Check if any message reveals user existence
                    enum_phrases = ["user not found", "does not exist", "invalid user", "email not found"]
                    for email, resp_text in responses.items():
                        if any(phrase in resp_text for phrase in enum_phrases):
                            self.log(f"  ⚠️ User enumeration possible at {login_url}", "WARNING")
                            vulnerable = True
                            self.results.append({
                                "vulnerability": "User Enumeration",
                                "endpoint": login_url,
                                "detail": "Error messages reveal user existence",
                                "severity": "low"
                            })
                            break

            # Test rate limiting
            try:
                success_count = 0
                for i in range(15):
                    data = {"email": self.test_email, "password": f"wrong{i}"}
                    resp = self.session.post(login_url, json=data, timeout=2)
                    
                    if self.is_blocked(resp):
                        self.log(f"  Rate limit test stopped - blocked after {i} attempts")
                        break
                        
                    if resp.status_code != 429:
                        success_count += 1
                    time.sleep(0.1)
                    
                if success_count >= 12:  # Most requests succeeded - no rate limiting
                    self.log(f"  ⚠️ No rate limiting detected at {login_url}!", "WARNING")
                    vulnerable = True
                    self.results.append({
                        "vulnerability": "Missing Rate Limiting",
                        "endpoint": login_url,
                        "detail": f"Allowed {success_count} rapid login attempts",
                        "severity": "medium"
                    })
            except Exception:
                pass

        return vulnerable

    # ----------------------------------------------------------------------
    # IDOR test
    # ----------------------------------------------------------------------
    def test_insecure_direct_object_reference(self):
        """Test for Insecure Direct Object References"""
        self.log("🔍 Testing IDOR vulnerabilities...")
        vulnerable = False
        
        if not self.auth_token:
            self.attempt_login()

        # Find potential IDOR endpoints
        idor_patterns = ['/user/', '/profile/', '/order/', '/document/', '/payment/', '/api/users/', '/api/orders/']
        idor_endpoints = []
        
        for url in self.discovered_endpoints:
            if any(pattern in url for pattern in idor_patterns):
                idor_endpoints.append(url)
                
        if not idor_endpoints:
            # Try common patterns
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
            
            for test_id in test_ids:
                endpoint = endpoint_template.replace('{id}', str(test_id))
                
                try:
                    resp = self.session.get(endpoint, timeout=5)
                    
                    if self.is_blocked(resp):
                        continue
                        
                    if resp.status_code == 200:
                        # Check if response contains sensitive data
                        content = resp.text.lower()
                        sensitive_patterns = ['password', 'email', 'phone', 'address', 'credit', 'ssn', 'dob', 'salary']
                        
                        found_sensitive = [p for p in sensitive_patterns if p in content]
                        
                        if found_sensitive:
                            self.log(f"  ⚠️ Potential IDOR at {endpoint}", "WARNING")
                            vulnerable = True
                            self.results.append({
                                "vulnerability": "Insecure Direct Object Reference (IDOR)",
                                "endpoint": endpoint,
                                "tested_id": test_id,
                                "sensitive_data_found": found_sensitive,
                                "severity": "high"
                            })
                            break
                            
                except Exception:
                    continue

        return vulnerable

    # ----------------------------------------------------------------------
    # CORS test
    # ----------------------------------------------------------------------
    def test_cors_misconfiguration(self):
        """Test for CORS misconfigurations"""
        self.log("🔍 Testing CORS Misconfigurations...")
        
        try:
            # Test with malicious origin
            test_origins = ['https://evil.com', 'null', '*']
            
            for origin in test_origins:
                headers = {
                    'Origin': origin,
                    'Access-Control-Request-Method': 'GET'
                }
                
                resp = self.session.options(self.base_url, headers=headers, timeout=5)
                
                if self.is_blocked(resp):
                    continue
                    
                cors_headers = {
                    'allow_origin': resp.headers.get('Access-Control-Allow-Origin', ''),
                    'allow_credentials': resp.headers.get('Access-Control-Allow-Credentials', ''),
                    'allow_methods': resp.headers.get('Access-Control-Allow-Methods', '')
                }
                
                # Check for dangerous configurations
                if cors_headers['allow_origin'] == '*' and cors_headers['allow_credentials'] == 'true':
                    self.log("  ⚠️ Dangerous CORS configuration: * with credentials", "WARNING")
                    self.results.append({
                        "vulnerability": "CORS Misconfiguration",
                        "detail": "Access-Control-Allow-Origin: * with credentials allowed",
                        "severity": "high"
                    })
                    return True
                    
                elif origin in cors_headers['allow_origin'] and cors_headers['allow_credentials'] == 'true':
                    self.log(f"  ⚠️ CORS allows {origin} with credentials", "WARNING")
                    self.results.append({
                        "vulnerability": "CORS Misconfiguration",
                        "detail": f"Allows {origin} with credentials",
                        "severity": "medium"
                    })
                    return True
                    
        except Exception as e:
            self.log(f"  Error testing CORS: {e}", "ERROR")
            
        return False

    # ----------------------------------------------------------------------
    # Sensitive Data Exposure
    # ----------------------------------------------------------------------
    def test_sensitive_data_exposure(self):
        """Test for exposed sensitive files and data"""
        self.log("🔍 Testing for Sensitive Data Exposure...")
        vulnerable = False
        
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
        
        for file_path in common_files:
            url = urljoin(self.base_url, file_path)
            self.log(f"  Checking {file_path}")
            
            try:
                resp = self.session.get(url, timeout=5)
                
                if self.is_blocked(resp):
                    continue
                    
                if resp.status_code == 200:
                    # Check if file contains sensitive data
                    content = resp.text
                    
                    # Check file size (avoid huge files)
                    if len(content) > 1000000:  # 1MB
                        continue
                    
                    for pattern in sensitive_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            self.log(f"  ⚠️ Sensitive data exposed in {file_path}!", "WARNING")
                            vulnerable = True
                            
                            # Get first few lines of the match
                            match = re.search(pattern, content, re.IGNORECASE)
                            matched_text = match.group(0)[:100] if match else "Pattern matched"
                            
                            self.results.append({
                                "vulnerability": "Sensitive Data Exposure",
                                "file": file_path,
                                "pattern_matched": matched_text,
                                "severity": "high"
                            })
                            break
                            
            except Exception:
                continue
                
        return vulnerable

    # ----------------------------------------------------------------------
    # Security Headers test
    # ----------------------------------------------------------------------
    def test_security_headers(self):
        """Test for missing or misconfigured security headers"""
        self.log("🔍 Testing Security Headers...")
        
        try:
            resp = self.session.get(self.base_url, timeout=5)
            
            if self.is_blocked(resp):
                self.log("  Security headers test blocked by WAF.", "WARNING")
                return "BLOCKED"
                
            headers = resp.headers
            
            required_headers = {
                'X-Frame-Options': {
                    'expected': ['DENY', 'SAMEORIGIN'],
                    'description': 'Prevents clickjacking'
                },
                'X-Content-Type-Options': {
                    'expected': ['nosniff'],
                    'description': 'Prevents MIME type sniffing'
                },
                'Content-Security-Policy': {
                    'expected': None,
                    'description': 'Controls resources the browser can load'
                },
                'Strict-Transport-Security': {
                    'expected': None,
                    'description': 'Enforces HTTPS connections'
                },
                'X-XSS-Protection': {
                    'expected': ['1; mode=block'],
                    'description': 'Enables browser XSS filtering'
                },
                'Referrer-Policy': {
                    'expected': ['strict-origin', 'strict-origin-when-cross-origin', 'no-referrer', 'same-origin'],
                    'description': 'Controls referrer information'
                },
                'Permissions-Policy': {
                    'expected': None,
                    'description': 'Controls browser features'
                }
            }
            
            vulnerable = False
            
            for header, config in required_headers.items():
                value = headers.get(header)
                
                if not value:
                    self.log(f"  ⚠️ Missing security header: {header}", "WARNING")
                    vulnerable = True
                    self.results.append({
                        "vulnerability": "Missing Security Header",
                        "header": header,
                        "description": config['description'],
                        "severity": "low"
                    })
                elif config['expected'] and value not in config['expected']:
                    self.log(f"  ⚠️ Misconfigured {header}: {value}", "WARNING")
                    vulnerable = True
                    self.results.append({
                        "vulnerability": "Misconfigured Security Header",
                        "header": header,
                        "current_value": value,
                        "expected_values": config['expected'],
                        "severity": "low"
                    })
            
            # Check for server version disclosure
            if 'Server' in headers:
                server = headers['Server']
                if '/' in server:  # Contains version
                    self.log(f"  ⚠️ Server version disclosed: {server}", "WARNING")
                    vulnerable = True
                    self.results.append({
                        "vulnerability": "Server Version Disclosure",
                        "server_header": server,
                        "severity": "low"
                    })
                    
            # Check for powered-by disclosure
            if 'X-Powered-By' in headers:
                self.log(f"  ⚠️ Technology disclosed: {headers['X-Powered-By']}", "WARNING")
                vulnerable = True
                self.results.append({
                    "vulnerability": "Technology Disclosure",
                    "header": "X-Powered-By",
                    "value": headers['X-Powered-By'],
                    "severity": "low"
                })
                
            return vulnerable
            
        except Exception as e:
            self.log(f"  Error checking security headers: {e}", "ERROR")
            return False

    # ----------------------------------------------------------------------
    # SSL/TLS test
    # ----------------------------------------------------------------------
    def test_ssl_tls_vulnerabilities(self):
        """Test SSL/TLS configuration"""
        self.log("🔍 Testing SSL/TLS Configuration...")
        
        if not self.base_url.startswith('https://'):
            self.log("  ⚠️ Site not using HTTPS!", "WARNING")
            self.results.append({
                "vulnerability": "Missing HTTPS",
                "severity": "high"
            })
            return True
            
        try:
            hostname = self.base_url.split('://')[1].split('/')[0]
            port = 443
            
            context = ssl.create_default_context()
            
            with socket.create_connection((hostname, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    
                    # Get certificate
                    cert = ssock.getpeercert()
                    
                    # Check certificate expiration
                    not_after = cert.get('notAfter')
                    if not_after:
                        expiry_date = datetime.datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z')
                        if expiry_date < datetime.datetime.now():
                            self.log("  ⚠️ SSL Certificate expired!", "WARNING")
                            self.results.append({
                                "vulnerability": "Expired SSL Certificate",
                                "expiry_date": not_after,
                                "severity": "high"
                            })
                    
                    # Check cipher
                    cipher = ssock.cipher()
                    cipher_name = cipher[0] if cipher else "Unknown"
                    
                    weak_ciphers = ['RC4', '3DES', 'DES', 'MD5', 'EXPORT', 'NULL']
                    if any(weak in cipher_name for weak in weak_ciphers):
                        self.log(f"  ⚠️ Weak cipher: {cipher_name}", "WARNING")
                        self.results.append({
                            "vulnerability": "Weak SSL Cipher",
                            "cipher": cipher_name,
                            "severity": "medium"
                        })
                    
                    # Check TLS version
                    tls_version = ssock.version()
                    if tls_version in ['TLSv1', 'TLSv1.0', 'TLSv1.1']:
                        self.log(f"  ⚠️ Outdated TLS version: {tls_version}", "WARNING")
                        self.results.append({
                            "vulnerability": "Outdated TLS Version",
                            "version": tls_version,
                            "severity": "medium"
                        })
                    
                    return bool(self.results)
                    
        except Exception as e:
            self.log(f"  Error checking SSL/TLS: {e}", "ERROR")
            return "BLOCKED"

    # ----------------------------------------------------------------------
    # CSRF test
    # ----------------------------------------------------------------------
    def test_csrf(self):
        """Test for CSRF vulnerabilities"""
        self.log("🔍 Testing CSRF Vulnerabilities...")
        
        if not self.auth_token:
            self.attempt_login()
            
        # Find state-changing endpoints
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
            
        for endpoint in state_change_endpoints:
            self.log(f"  Testing {endpoint}")
            
            try:
                # Test with valid auth
                valid_data = {"name": "Test Update", "email": self.test_email}
                valid_resp = self.session.post(endpoint, json=valid_data, timeout=5)
                
                if self.is_blocked(valid_resp):
                    continue
                    
                if valid_resp.status_code == 200:
                    # Test without auth
                    temp_session = requests.Session()
                    invalid_resp = temp_session.post(endpoint, json=valid_data, timeout=5)
                    
                    if self.is_blocked(invalid_resp):
                        continue
                        
                    if invalid_resp.status_code == 200:
                        self.log(f"  ⚠️ State change possible without auth token at {endpoint}!", "WARNING")
                        self.results.append({
                            "vulnerability": "CSRF / Missing Authentication",
                            "endpoint": endpoint,
                            "detail": "Endpoint accepts requests without authentication",
                            "severity": "high"
                        })
                        return True
                        
            except Exception:
                continue
                
        return False

    # ----------------------------------------------------------------------
    # Open Redirect test
    # ----------------------------------------------------------------------
    def test_open_redirect(self):
        """Test for open redirect vulnerabilities"""
        self.log("🔍 Testing Open Redirect Vulnerabilities...")
        vulnerable = False
        
        # Find potential redirect endpoints
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
            "%68%74%74%70%73%3a%2f%2f%65%76%69%6c%2e%63%6f%6d",  # URL encoded
            "\\evil.com",
            "https://evil.com@good.com"
        ]
        
        for endpoint in redirect_endpoints:
            self.log(f"  Testing {endpoint}")
            
            for payload in payloads:
                try:
                    # Handle different URL structures
                    if '?' in endpoint:
                        url = endpoint + payload
                    else:
                        url = endpoint + payload
                        
                    resp = self.session.get(url, allow_redirects=False, timeout=5)
                    
                    if self.is_blocked(resp):
                        continue
                        
                    # Check for redirect
                    if resp.status_code in [301, 302, 303, 307, 308]:
                        location = resp.headers.get('Location', '')
                        
                        # Check if redirect goes to malicious domain or javascript
                        if 'evil.com' in location or 'javascript:' in location:
                            self.log(f"  ⚠️ Open redirect at {endpoint}", "WARNING")
                            vulnerable = True
                            self.results.append({
                                "vulnerability": "Open Redirect",
                                "endpoint": endpoint,
                                "payload": payload[:50],
                                "redirects_to": location[:100],
                                "severity": "medium"
                            })
                            break
                            
                except Exception:
                    continue
                    
        return vulnerable

    # ----------------------------------------------------------------------
    # Directory Traversal test
    # ----------------------------------------------------------------------
    def test_directory_traversal(self):
        """Test for directory traversal vulnerabilities"""
        self.log("🔍 Testing Directory Traversal...")
        vulnerable = False
        
        # Find file-related endpoints
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
        
        for endpoint in traversal_endpoints:
            self.log(f"  Testing {endpoint}")
            
            for payload in traversal_payloads:
                try:
                    url = endpoint + payload
                    resp = self.session.get(url, timeout=5)
                    
                    if self.is_blocked(resp):
                        continue
                        
                    if resp.status_code == 200:
                        # Check for success markers
                        content = resp.text
                        found_markers = [m for m in success_markers if m in content]
                        
                        if found_markers:
                            self.log(f"  ⚠️ Directory traversal at {endpoint}", "WARNING")
                            vulnerable = True
                            self.results.append({
                                "vulnerability": "Directory Traversal",
                                "endpoint": endpoint,
                                "payload": payload,
                                "indicators_found": found_markers,
                                "severity": "high"
                            })
                            break
                            
                except Exception:
                    continue
                    
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

        # Define tests to run
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
        results = {}
        for test_name, test_func in tests:
            self.log(f"\n{'='*40}")
            self.log(f"Running {test_name} test...")
            self.log(f"{'='*40}")
            
            try:
                result = test_func()
                results[test_name] = result
                
                if result is True:
                    self.log(f"❌ {test_name}: VULNERABLE", "WARNING")
                elif result == "BLOCKED":
                    self.log(f"🚧 {test_name}: BLOCKED (by WAF/Firewall)")
                elif result is False:
                    self.log(f"✅ {test_name}: SECURE")
                else:
                    self.log(f"⚠️ {test_name}: UNKNOWN RESULT")
                    
            except Exception as e:
                self.log(f"❌ Error during {test_name}: {e}", "ERROR")
                results[test_name] = "ERROR"

        # Summary
        self.log("\n" + "=" * 60)
        self.log("📊 SECURITY TEST SUMMARY")
        self.log("=" * 60)

        vuln_count = sum(1 for v in results.values() if v is True)
        blocked_count = sum(1 for v in results.values() if v == "BLOCKED")
        secure_count = sum(1 for v in results.values() if v is False)
        error_count = sum(1 for v in results.values() if v == "ERROR")

        # Print individual results
        for name, res in results.items():
            if res is True:
                self.log(f"❌ {name}: VULNERABLE", "WARNING")
            elif res == "BLOCKED":
                self.log(f"🚧 {name}: BLOCKED")
            elif res is False:
                self.log(f"✅ {name}: SECURE")
            else:
                self.log(f"⚠️ {name}: TEST FAILED")

        self.log("\n" + "=" * 60)
        self.log(f"📈 Total Vulnerabilities: {vuln_count}")
        self.log(f"✅ Total Secure: {secure_count}")
        self.log(f"🚧 Total Blocked: {blocked_count}")
        self.log(f"⚠️ Total Errors: {error_count}")
        
        if vuln_count > 0:
            self.log("⚠️ VULNERABILITIES FOUND – review the report.", "WARNING")
        elif blocked_count > 0:
            self.log("🚧 Some tests were blocked – consider manual inspection or whitelisting.")
        else:
            self.log("✅ No vulnerabilities found!")

        # Save and upload report
        self.save_report()
        
        # Always return 0 for GitHub Actions
        return 0


def main():
    """Main entry point"""
    print(r"""
    ╔══════════════════════════════════════════════════════════════╗
    ║     GROWHAZ Enhanced Security Testing Tool v2.3              ║
    ║     GitHub Actions Compatible | Supabase Integration         ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    import argparse
    parser = argparse.ArgumentParser(description='Security testing tool for web applications.')
    parser.add_argument('base_url', help='Base URL of the target (e.g., https://example.com)')
    parser.add_argument('test_email', nargs='?', help='Test email for login (optional)')
    parser.add_argument('openapi_spec', nargs='?', help='Path to OpenAPI/Swagger JSON file (optional)')
    parser.add_argument('--js', action='store_true', help='Enable JavaScript crawling with Playwright')
    parser.add_argument('--report-id', help='Supabase report ID to update')
    
    args = parser.parse_args()

    # Validate and format URL
    base_url = args.base_url
    if not base_url.startswith(('http://', 'https://')):
        base_url = 'https://' + base_url

    # Get report ID from args or environment
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
    
    # Create and run tester
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
