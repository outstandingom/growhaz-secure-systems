"""
Static and Playwright crawlers for comprehensive endpoint discovery.

Strategy:
  1. Seed from robots.txt, sitemap.xml, common paths, and SPA hints.
  2. Walk HTML pages and mine JS bundles/chunks recursively for API routes, Supabase endpoints, and fetch/axios calls.
  3. Intercept live browser network traffic (Playwright) capturing methods, full URLs, query parameters,
     POST body fields, and authentication headers (e.g. apikey, Authorization).
  4. Classify in-scope endpoints (domain, subdomains, BaaS/Supabase, API backends) vs third-party telemetry.
  5. Return a clean, rich, deduplicated endpoint inventory for testing.
"""

import re
from typing import List, Set, Iterable
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs
from xml.etree import ElementTree as ET

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine
from scanner.discovery.scope import is_target_scope


SPA_ROUTE_HINTS = [
    '/', '/about', '/contact', '/pricing', '/blog', '/login', '/signup',
    '/register', '/auth', '/dashboard', '/profile', '/admin', '/settings',
    '/search', '/terms', '/privacy', '/privacy-policy',
]

EXPOSURE_PATHS = [
    '/api', '/api/v1', '/api/v2', '/graphql', '/swagger', '/swagger.json',
    '/openapi.json', '/openapi.yaml', '/api-docs',
    '/robots.txt', '/sitemap.xml', '/sitemap_index.xml',
    '/.well-known/security.txt',
    '/.env', '/.env.local', '/.env.production', '/.git/HEAD', '/.git/config',
    '/config.json', '/package.json',
    '/admin', '/administrator', '/wp-admin', '/wp-login.php',
    '/health', '/healthz', '/status', '/metrics',
    '/phpinfo.php', '/info.php', '/backup.sql', '/backup.zip',
    '/server-status', '/actuator', '/actuator/health', '/actuator/env',
]

SITEMAP_CANDIDATES = [
    'sitemap.xml', 'sitemap_index.xml', 'sitemap-index.xml',
    'sitemap/sitemap.xml', 'sitemaps/sitemap.xml', 'sitemap1.xml',
]

JS_ROUTE_RE = re.compile(r'''(?:\bpath|\bto)\s*[:=]\s*["'`](\/[A-Za-z0-9_\-./:]{0,120})["'`]''')
JS_API_RE = re.compile(
    r'''(?:fetch|axios(?:\.\w+)?|request|http(?:\.\w+)?|\$\.(?:get|post|ajax))\s*\(\s*["'`]([^"'`]+)["'`]'''
)
JS_URL_RE = re.compile(r'''["'`](https?://[^"'`\s]{6,300})["'`]''')

SKIP_EXT = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz',
    '.css', '.map',
)

CORE_TABLES = [
    "profiles", "organizations", "users", "sites", "mentors",
    "api_keys", "projects", "sessions", "orders", "documents",
    "accounts", "items", "reports", "settings"
]


def _normalize(url: str) -> str:
    try:
        p = urlparse(url)
        path = p.path or '/'
        if len(path) > 1 and path.endswith('/'):
            path = path.rstrip('/')
        return urlunparse((p.scheme, p.netloc.lower(), path, p.params, p.query, ''))
    except Exception:
        return url


class StaticCrawler:
    def __init__(self, base_url: str, request_engine: RequestEngine):
        self.base_url = base_url.rstrip('/')
        self.request_engine = request_engine
        self.visited: Set[str] = set()
        self.candidates: Set[str] = set()
        self.candidate_meta: dict = {}
        self.confirmed: dict = {}

    def _same_host(self, url: str) -> bool:
        try:
            a = urlparse(url).netloc.lower()
            b = urlparse(self.base_url).netloc.lower()
            a = a[4:] if a.startswith('www.') else a
            b = b[4:] if b.startswith('www.') else b
            return a == b or a.endswith('.' + b) or b.endswith('.' + a)
        except Exception:
            return False

    def _add_candidate(self, url: str, *, method: str = "GET",
                       source: DiscoverySource = DiscoverySource.STATIC_CRAWL,
                       state_changing: bool = False, params=None,
                       default_params=None, headers=None,
                       accepts_json: bool = False) -> None:
        if not url:
            return
        if url.lower().split('?', 1)[0].endswith(SKIP_EXT):
            return
        if not url.startswith(('http://', 'https://')):
            return
        if not is_target_scope(url, self.base_url, headers):
            return

        parsed_params = list(params or [])
        parsed_defaults = dict(default_params or {})
        try:
            parsed = urlparse(url)
            clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            if parsed.query:
                qs = parse_qs(parsed.query)
                for qk, qv in qs.items():
                    if qk not in parsed_params:
                        parsed_params.append(qk)
                    if qk not in parsed_defaults and qv:
                        parsed_defaults[qk] = qv[0]
            url = clean_url if clean_url else url
        except Exception:
            pass

        norm = _normalize(url)
        key = f"{method}:{norm}"
        if key in self.candidate_meta:
            for p in parsed_params:
                if p not in self.candidate_meta[key]['params']:
                    self.candidate_meta[key]['params'].append(p)
            if parsed_defaults:
                self.candidate_meta[key].setdefault('default_params', {}).update(parsed_defaults)
            if headers:
                self.candidate_meta[key].setdefault('headers', {}).update(headers)
            return

        self.candidates.add(norm)
        self.candidate_meta[key] = dict(
            url=norm, method=method, source=source,
            state_changing=state_changing, params=parsed_params,
            default_params=parsed_defaults,
            headers=dict(headers or {}),
            accepts_json=accepts_json,
        )

    def _seed_from_sitemap(self, sitemap_url: str, depth: int = 0) -> int:
        if depth > 2:
            return 0
        r = self.request_engine.request("GET", sitemap_url)
        if not r.has_response or not r.body or r.status_code >= 400:
            return 0
        added = 0
        try:
            body = re.sub(r'\sxmlns="[^"]+"', '', r.body, count=1)
            root = ET.fromstring(body)
            if 'sitemapindex' in root.tag.lower():
                for loc in root.findall('.//loc'):
                    if loc.text:
                        added += self._seed_from_sitemap(loc.text.strip(), depth + 1)
            else:
                for loc in root.findall('.//loc'):
                    if loc.text and self._same_host(loc.text):
                        self._add_candidate(loc.text.strip())
                        added += 1
        except ET.ParseError:
            for m in re.finditer(r'<loc>\s*([^<]+?)\s*</loc>', r.body):
                url = m.group(1).strip()
                if self._same_host(url):
                    self._add_candidate(url)
                    added += 1
        return added

    def _seed_from_robots(self) -> None:
        r = self.request_engine.request("GET", urljoin(self.base_url + '/', 'robots.txt'))
        if not r.has_response or not r.body or r.status_code >= 400:
            return
        for line in r.body.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            low = line.lower()
            if low.startswith('sitemap:'):
                sm = line.split(':', 1)[1].strip()
                self._seed_from_sitemap(sm)
            elif low.startswith(('disallow:', 'allow:')):
                path = line.split(':', 1)[1].strip()
                if path and path != '/':
                    self._add_candidate(urljoin(self.base_url + '/', path.lstrip('/')))

    def _seed_common_paths(self) -> None:
        for path in SPA_ROUTE_HINTS + EXPOSURE_PATHS:
            self._add_candidate(
                urljoin(self.base_url + '/', path.lstrip('/')),
                source=DiscoverySource.COMMON_PATH,
            )

    def _mine_js(self, js_body: str) -> None:
        seen = set()

        def keep(path: str) -> bool:
            if not path or path in seen:
                return False
            seen.add(path)
            if path.startswith('//') or path.startswith('data:'):
                return False
            bad = ('/node_modules/', '/@vite/', '/src/', '/*.', '{', '}', '\\', ' ')
            if any(b in path for b in bad):
                return False
            if path.lower().endswith(SKIP_EXT):
                return False
            if len(path) < 2 or len(path) > 200:
                return False
            return True

        # Supabase and BaaS detection
        sb_match = re.search(r'''https://([a-zA-Z0-9_-]+)\.supabase\.co''', js_body, re.I)
        sb_url = sb_match.group(0) if sb_match else None
        key_match = re.search(r'''eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+''', js_body)
        sb_key = key_match.group(0) if key_match else ""
        sb_headers = {}
        if sb_key:
            sb_headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

        if sb_url:
            tbl_matches = set(re.findall(r'''\.from\(["']([a-zA-Z0-9_]{2,40})["']\)''', js_body) +
                              re.findall(r'''/rest/v1/([a-zA-Z0-9_]{2,40})''', js_body))
            for tbl in (tbl_matches | set(CORE_TABLES)):
                rest_url = f"{sb_url}/rest/v1/{tbl}"
                self._add_candidate(rest_url, method="GET", source=DiscoverySource.JS_CRAWL,
                                    params=["select", "id", "user_id"],
                                    default_params={"select": "*"},
                                    headers=sb_headers, accepts_json=True)

        for m in JS_ROUTE_RE.finditer(js_body):
            path = m.group(1)
            if keep(path):
                self._add_candidate(
                    urljoin(self.base_url + '/', path.lstrip('/')),
                    source=DiscoverySource.JS_CRAWL,
                )
        for m in JS_API_RE.finditer(js_body):
            path = m.group(1)
            if path.startswith('http'):
                if is_target_scope(path, self.base_url):
                    self._add_candidate(path, source=DiscoverySource.JS_CRAWL, accepts_json=True)
                continue
            if keep(path):
                self._add_candidate(
                    urljoin(self.base_url + '/', path.lstrip('/')),
                    source=DiscoverySource.JS_CRAWL, accepts_json=True,
                )
        for m in JS_URL_RE.finditer(js_body):
            url = m.group(1)
            if is_target_scope(url, self.base_url):
                self._add_candidate(url, source=DiscoverySource.JS_CRAWL, accepts_json=True)

        # Recursively inspect referenced JS chunks
        chunk_files = set(re.findall(r'[a-zA-Z0-9_.-]{3,60}\.js', js_body))
        for ch in chunk_files:
            if ch.endswith('.js') and not ch.startswith(('http', 'data')) and 'node_modules' not in ch:
                ch_url = urljoin(self.base_url + '/', f"assets/{ch}")
                if ch_url not in self.visited:
                    self.visited.add(ch_url)
                    cr = self.request_engine.request("GET", ch_url)
                    if cr.has_response and cr.status_code == 200 and cr.body:
                        self._mine_js(cr.body)

    def _process_html(self, current_url: str, body: str, queue: List[str],
                      js_scanned: Set[str]) -> None:
        soup = BeautifulSoup(body, 'html.parser')

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                continue
            full = urljoin(current_url, href).split('#', 1)[0]
            if self._same_host(full):
                norm = _normalize(full)
                if norm not in self.visited and norm not in queue:
                    queue.append(norm)
            if is_target_scope(full, self.base_url):
                self._add_candidate(full, source=DiscoverySource.STATIC_CRAWL)

        for s in soup.find_all('script', src=True):
            src = s['src']
            if not src or 'node_modules' in src:
                continue
            js_url = urljoin(current_url, src)
            if not self._same_host(js_url) or js_url in js_scanned:
                continue
            js_scanned.add(js_url)
            jr = self.request_engine.request("GET", js_url)
            if jr.has_response and jr.status_code < 400 and jr.body:
                self._mine_js(jr.body)

        for form in soup.find_all('form'):
            action = form.get('action', '') or current_url
            method = (form.get('method', 'GET') or 'GET').upper()
            form_url = urljoin(current_url, action)
            inputs = form.find_all(['input', 'select', 'textarea'])
            params = [i.get('name') for i in inputs if i.get('name')]
            state = method in ('POST', 'PUT', 'DELETE', 'PATCH')
            self._add_candidate(form_url, method=method,
                                source=DiscoverySource.FORM,
                                state_changing=state, params=params)

        for inp in soup.find_all(['input', 'textarea']):
            name = inp.get('name') or inp.get('id')
            if name and not any(p in name.lower() for p in ('csrf', '__viewstate')):
                self._add_candidate(current_url, method="GET",
                                    source=DiscoverySource.FORM,
                                    params=[name])

    def _spa_fallback_signature(self) -> tuple:
        probe_url = urljoin(self.base_url + '/', '__lovable_probe_' + '7f3a9c' + '__/x')
        r = self.request_engine.request("GET", probe_url)
        if not r.has_response or r.status_code != 200 or not r.body:
            return (None, None)
        ct = (r.headers.get("Content-Type", "") or "").lower()
        if 'html' not in ct:
            return (None, None)
        title_m = re.search(r'<title[^>]*>([^<]{0,200})</title>', r.body, re.I)
        title = (title_m.group(1).strip() if title_m else '')
        return (len(r.body), title)

    def _validate_candidates(self, max_probes: int = 300) -> None:
        alive = {200, 201, 202, 204, 206, 301, 302, 303, 307, 308, 401, 403, 405}
        spa_len, spa_title = self._spa_fallback_signature()
        probed = 0
        for key, meta in list(self.candidate_meta.items()):
            if probed >= max_probes:
                break
            url = meta['url']

            # Direct confirmation for known BaaS / REST APIs and state-changing forms
            if "supabase.co" in url or "/rest/v1/" in url or meta['state_changing']:
                self._confirm(meta, content_type='application/json', accepts_json=True)
                continue

            probed += 1
            headers = meta.get('headers', {})
            r = self.request_engine.request("GET", url, headers=headers)
            if not r.has_response:
                continue
            status = r.status_code
            if status not in alive:
                continue
            ct = (r.headers.get("Content-Type", "") or "").lower()

            if (spa_len is not None and status == 200 and 'html' in ct and r.body
                    and abs(len(r.body) - spa_len) < 64):
                title_m = re.search(r'<title[^>]*>([^<]{0,200})</title>', r.body, re.I)
                title = (title_m.group(1).strip() if title_m else '')
                if title == spa_title:
                    if meta['source'] == DiscoverySource.COMMON_PATH:
                        continue

            self._confirm(meta, content_type=ct,
                          accepts_json=meta['accepts_json'] or 'application/json' in ct)

    def _confirm(self, meta: dict, *, content_type: str, accepts_json: bool) -> None:
        info = EndpointInfo(
            url=meta['url'],
            method=meta['method'],
            discovery_source=meta['source'],
            is_state_changing=meta['state_changing'],
            body_params=meta['params'] if meta['state_changing'] else [],
            query_params=meta['params'] if (meta['params'] and not meta['state_changing']) else [],
            default_params=meta.get('default_params', {}),
            headers=meta.get('headers', {}),
            accepts_json=accepts_json,
            content_type=content_type,
        )
        key = f"{info.method}:{info.url}"
        if key not in self.confirmed:
            self.confirmed[key] = info
        else:
            self.confirmed[key].merge(info)

    def crawl(self, max_pages: int = 60) -> List[EndpointInfo]:
        self._add_candidate(self.base_url + '/')
        self._seed_from_robots()
        for sm in SITEMAP_CANDIDATES:
            self._seed_from_sitemap(urljoin(self.base_url + '/', sm))
        self._seed_common_paths()

        queue: List[str] = [_normalize(self.base_url + '/')]
        js_scanned: Set[str] = set()
        pages = 0
        while queue and pages < max_pages:
            url = queue.pop(0)
            if url in self.visited:
                continue
            self.visited.add(url)
            r = self.request_engine.request("GET", url)
            if not r.has_response or r.status_code >= 400:
                continue
            pages += 1
            ct = (r.headers.get("Content-Type", "") or "").lower()
            body = r.body or ""
            if "application/json" in ct:
                self._add_candidate(url, accepts_json=True)
                continue
            if "javascript" in ct or url.endswith('.js'):
                if url not in js_scanned:
                    js_scanned.add(url)
                    self._mine_js(body)
                continue
            if "html" not in ct:
                continue
            self._process_html(url, body, queue, js_scanned)

        self._validate_candidates(max_probes=max_pages * 5)
        return list(self.confirmed.values())


class PlaywrightCrawler:
    """
    Headless browser crawler for modern SPA websites (React/Next.js/Angular).
    Intercepts network requests (DevTools emulation), executes JS, and extracts API endpoints.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.discovered_endpoints: List[EndpointInfo] = []
        self.visited_pages: Set[str] = set()
        self.intercepted_requests: List[EndpointInfo] = []
        self._base_domain = urlparse(base_url).netloc.lower()

    def _same_host(self, url: str) -> bool:
        try:
            netloc = urlparse(url).netloc.lower()
            a = netloc[4:] if netloc.startswith('www.') else netloc
            b = self._base_domain[4:] if self._base_domain.startswith('www.') else self._base_domain
            return a == b or a.endswith('.' + b) or b.endswith('.' + a)
        except Exception:
            return False

    async def _intercept_request(self, request) -> None:
        import json as _json

        url = request.url
        if url.lower().split('?', 1)[0].endswith(SKIP_EXT):
            return

        headers = dict(request.headers)
        if not is_target_scope(url, self.base_url, headers):
            return

        method = request.method.upper()
        body_params: List[str] = []
        query_params: List[str] = []
        default_params: dict = {}

        parsed = urlparse(url)
        clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
        if parsed.query:
            qs = parse_qs(parsed.query)
            query_params = list(qs.keys())
            default_params = {k: v[0] for k, v in qs.items()}

        try:
            post_data = request.post_data
            if post_data:
                try:
                    data = _json.loads(post_data)
                    if isinstance(data, dict):
                        body_params = list(data.keys())
                        for k, v in data.items():
                            if isinstance(v, (str, int, float, bool)):
                                default_params[k] = str(v)
                except Exception:
                    pass
        except Exception:
            pass

        api_headers = {}
        for hk, hv in headers.items():
            if hk.lower() in ('apikey', 'authorization', 'x-api-key', 'content-type', 'accept', 'x-client-info'):
                api_headers[hk] = hv

        info = EndpointInfo(
            url=clean_url if clean_url else url,
            method=method,
            discovery_source=DiscoverySource.NETWORK_INTERCEPT,
            is_state_changing=method in ('POST', 'PUT', 'DELETE', 'PATCH'),
            body_params=body_params,
            query_params=query_params,
            default_params=default_params,
            headers=api_headers,
            accepts_json=True,
        )
        self.intercepted_requests.append(info)

    async def _click_all_elements(self, page) -> None:
        import asyncio
        selectors = [
            'nav a[href]', 'button:not([type="submit"])', '[role="tab"]',
            '[role="button"]', 'a[href]:not([href^="mailto"]):not([href^="tel"])',
            'details > summary', '.dropdown-toggle', '[data-toggle]',
        ]
        for selector in selectors:
            try:
                elements = await page.query_selector_all(selector)
                for el in elements[:10]:
                    try:
                        href = await el.get_attribute('href')
                        if href and href.startswith('http') and not self._same_host(href):
                            continue
                        await el.click(timeout=3000)
                        await asyncio.sleep(1.2)
                    except Exception:
                        pass
            except Exception:
                pass

    async def _login(self, page, credentials: dict) -> dict:
        import asyncio
        email = (credentials.get('email') or credentials.get('username') or
                 credentials.get('phone') or credentials.get('mobile', ''))
        password = credentials.get('password', '')

        field_pairs = [
            ('input[name="email"]', 'input[name="password"]'),
            ('input[name="username"]', 'input[name="password"]'),
            ('input[type="email"]', 'input[type="password"]'),
            ('input[type="text"]', 'input[type="password"]'),
        ]

        for email_sel, pass_sel in field_pairs:
            try:
                email_el = await page.query_selector(email_sel)
                pass_el = await page.query_selector(pass_sel)
                if email_el and pass_el:
                    await email_el.fill(email)
                    await pass_el.fill(password)
                    await pass_el.press('Enter')
                    await asyncio.sleep(3)
                    cookies = await page.context.cookies()
                    return {c['name']: c['value'] for c in cookies}
            except Exception:
                continue
        return {}

    async def _parse_js_files(self, page) -> List[EndpointInfo]:
        js_urls: List[str] = await page.evaluate("""
            () => Array.from(document.querySelectorAll('script[src]'))
                       .map(s => s.src)
                       .filter(s => s && !s.includes('node_modules'))
        """)

        from scanner.discovery.js_api_extractor import JSAPIExtractor
        extractor = JSAPIExtractor(self.base_url)
        return extractor.extract_from_urls(js_urls[:25])

    async def crawl(
        self,
        credentials: dict = None,
        max_pages: int = 100,
    ) -> List[EndpointInfo]:
        import asyncio
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError("Playwright not installed. Run: pip install playwright && playwright install chromium")

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                ignore_https_errors=True,
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            )
            page = await context.new_page()
            page.on('request', lambda req: asyncio.ensure_future(self._intercept_request(req)))

            try:
                await page.goto(self.base_url, wait_until='networkidle', timeout=30000)
            except Exception:
                try:
                    await page.goto(self.base_url, wait_until='domcontentloaded', timeout=15000)
                except Exception:
                    await browser.close()
                    return []

            self.visited_pages.add(self.base_url)

            if credentials:
                try:
                    for login_path in ['/login', '/signin', '/auth/login', '/auth']:
                        login_url = self.base_url + login_path
                        try:
                            await page.goto(login_url, wait_until='networkidle', timeout=10000)
                            cookies = await self._login(page, credentials)
                            if cookies:
                                break
                        except Exception:
                            continue
                    await page.goto(self.base_url, wait_until='networkidle', timeout=30000)
                except Exception:
                    pass

            await self._click_all_elements(page)

            links: List[str] = await page.evaluate("""
                () => Array.from(document.querySelectorAll('a[href]'))
                           .map(a => a.href)
                           .filter(h => h && !h.startsWith('javascript:') && !h.startsWith('mailto:'))
            """)

            queue = [lnk for lnk in links if self._same_host(lnk)]
            pages_crawled = 1
            while queue and pages_crawled < max_pages:
                url = queue.pop(0)
                norm = _normalize(url)
                if norm in self.visited_pages:
                    continue
                self.visited_pages.add(norm)
                try:
                    await page.goto(url, wait_until='networkidle', timeout=15000)
                    pages_crawled += 1
                    await self._click_all_elements(page)
                    new_links: List[str] = await page.evaluate("""
                        () => Array.from(document.querySelectorAll('a[href]'))
                                   .map(a => a.href)
                                   .filter(h => h && !h.startsWith('javascript:'))
                    """)
                    for lnk in new_links:
                        if self._same_host(lnk) and _normalize(lnk) not in self.visited_pages:
                            queue.append(lnk)
                except Exception:
                    pass

            try:
                parsed_eps = await self._parse_js_files(page)
                self.discovered_endpoints.extend(parsed_eps)
            except Exception:
                pass

            await browser.close()

        all_eps: List[EndpointInfo] = []
        seen_keys: Set[str] = set()
        for ep in self.intercepted_requests + self.discovered_endpoints:
            key = f"{ep.method}:{_normalize(ep.url)}"
            if key not in seen_keys:
                seen_keys.add(key)
                all_eps.append(ep)

        return all_eps
