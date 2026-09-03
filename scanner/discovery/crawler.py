"""
Static crawler for endpoint discovery.

Strategy (discover-first, then validate):
  1. Seed from robots.txt, sitemap.xml (recursive), common paths, and SPA hints.
  2. Fetch homepage + linked HTML pages, follow <a>, <form>, <script src>.
  3. Mine JS bundles for React-Router `path:"/..."`, `to="/..."`, and
     `fetch/axios/request("/api/...")` style calls — NOT every quoted string.
  4. Validate every candidate URL with a lightweight HEAD/GET; keep only
     URLs that resolve (2xx / 3xx, or 401/403 which prove the route exists).
  5. Return a clean, deduplicated endpoint inventory.
"""

import re
from typing import List, Set, Iterable
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree as ET

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine


# Client-rendered SPA route hints — probed once, kept only if they resolve.
SPA_ROUTE_HINTS = [
    '/', '/about', '/contact', '/pricing', '/blog', '/login', '/signup',
    '/register', '/auth', '/dashboard', '/profile', '/admin', '/settings',
    '/search', '/terms', '/privacy', '/privacy-policy',
]

# High-value fingerprint / exposure paths.
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

# Extra sitemap locations to probe.
SITEMAP_CANDIDATES = [
    'sitemap.xml', 'sitemap_index.xml', 'sitemap-index.xml',
    'sitemap/sitemap.xml', 'sitemaps/sitemap.xml', 'sitemap1.xml',
]

# JS route extraction — precise patterns, not "every quoted /path".
# React-Router: {path:"/foo"} or path: '/foo'  ; <Link to="/foo"> or to:"/foo"
JS_ROUTE_RE = re.compile(r'''(?:\bpath|\bto)\s*[:=]\s*["'`](\/[A-Za-z0-9_\-./:]{0,120})["'`]''')
# API/fetch calls: fetch("/api/x"), axios.get('/api/x'), request(`/api/x`)
JS_API_RE = re.compile(
    r'''(?:fetch|axios(?:\.\w+)?|request|http(?:\.\w+)?|\$\.(?:get|post|ajax))\s*\(\s*["'`]([^"'`]+)["'`]'''
)
# Absolute same-host URLs in JS
JS_URL_RE = re.compile(r'''["'`](https?://[^"'`\s]{6,300})["'`]''')

SKIP_EXT = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz',
    '.css', '.map',
)


def _normalize(url: str) -> str:
    """Drop fragment, collapse trailing slash (except root)."""
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
        self.candidates: Set[str] = set()      # normalized URLs pending validation
        self.candidate_meta: dict = {}         # url -> dict(method, source, params, state_changing)
        self.confirmed: dict = {}              # key -> EndpointInfo

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

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
                       accepts_json: bool = False) -> None:
        if not url:
            return
        if url.lower().split('?', 1)[0].endswith(SKIP_EXT):
            return
        if not url.startswith(('http://', 'https://')):
            return
        if not self._same_host(url):
            return
        norm = _normalize(url)
        key = f"{method}:{norm}"
        if key in self.candidate_meta:
            return
        self.candidates.add(norm)
        self.candidate_meta[key] = dict(
            url=norm, method=method, source=source,
            state_changing=state_changing, params=list(params or []),
            accepts_json=accepts_json,
        )

    # ------------------------------------------------------------------
    # Seeding
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # JS mining — precise patterns only
    # ------------------------------------------------------------------

    def _mine_js(self, js_body: str) -> None:
        seen = set()

        def keep(path: str) -> bool:
            if not path or path in seen:
                return False
            seen.add(path)
            if path.startswith('//') or path.startswith('data:'):
                return False
            # noise filters
            bad = ('/node_modules/', '/@vite/', '/src/', '/assets/',
                   '/*.', '://', '{', '}', '\\', ' ')
            if any(b in path for b in bad):
                return False
            if path.lower().endswith(SKIP_EXT):
                return False
            if len(path) < 2 or len(path) > 160:
                return False
            # must look route-like (start with / and only URL-safe chars)
            if not re.match(r'^/[A-Za-z0-9_\-./:]*$', path):
                return False
            return True

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
                if self._same_host(path):
                    self._add_candidate(path, source=DiscoverySource.JS_CRAWL,
                                        accepts_json=True)
                continue
            if keep(path):
                self._add_candidate(
                    urljoin(self.base_url + '/', path.lstrip('/')),
                    source=DiscoverySource.JS_CRAWL, accepts_json=True,
                )
        for m in JS_URL_RE.finditer(js_body):
            url = m.group(1)
            if self._same_host(url):
                self._add_candidate(url, source=DiscoverySource.JS_CRAWL)

    # ------------------------------------------------------------------
    # HTML link/form/script extraction (queue driver)
    # ------------------------------------------------------------------

    def _process_html(self, current_url: str, body: str, queue: List[str],
                      js_scanned: Set[str]) -> None:
        soup = BeautifulSoup(body, 'html.parser')

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                continue
            full = urljoin(current_url, href).split('#', 1)[0]
            if self._same_host(full):
                self._add_candidate(full)
                norm = _normalize(full)
                if norm not in self.visited and norm not in queue:
                    queue.append(norm)

        for script in soup.find_all('script', src=True):
            src = script['src']
            if not src or src.startswith(('javascript:', 'data:')):
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

    # ------------------------------------------------------------------
    # Validation — probe candidates and keep only those that resolve
    # ------------------------------------------------------------------

    def _spa_fallback_signature(self) -> tuple:
        """Fetch an unlikely URL; if the site returns 200 with HTML, capture its
        signature so we can drop SPA catch-all false positives."""
        probe_url = urljoin(self.base_url + '/', '__lovable_probe_' + '7f3a9c' + '__/x')
        r = self.request_engine.request("GET", probe_url)
        if not r.has_response or r.status_code != 200 or not r.body:
            return (None, None)
        ct = (r.headers.get("Content-Type", "") or "").lower()
        if 'html' not in ct:
            return (None, None)
        # signature = (approx body length, <title> text)
        title_m = re.search(r'<title[^>]*>([^<]{0,200})</title>', r.body, re.I)
        title = (title_m.group(1).strip() if title_m else '')
        return (len(r.body), title)

    def _validate_candidates(self, max_probes: int = 300) -> None:
        # 401/403 mean the route exists but is protected — still confirm.
        alive = {200, 201, 202, 204, 301, 302, 303, 307, 308, 401, 403, 405}
        spa_len, spa_title = self._spa_fallback_signature()
        probed = 0
        for key, meta in list(self.candidate_meta.items()):
            if probed >= max_probes:
                break
            url = meta['url']
            # Skip re-probing state-changing endpoints; trust their form source.
            if meta['state_changing']:
                self._confirm(meta, content_type='', accepts_json=meta['accepts_json'])
                continue
            probed += 1
            r = self.request_engine.request("GET", url)
            if not r.has_response:
                continue
            status = r.status_code
            if status not in alive:
                continue
            ct = (r.headers.get("Content-Type", "") or "").lower()

            # Drop SPA catch-all matches: identical length & title as the 404 fallback.
            if (spa_len is not None and status == 200 and 'html' in ct and r.body
                    and abs(len(r.body) - spa_len) < 64):
                title_m = re.search(r'<title[^>]*>([^<]{0,200})</title>', r.body, re.I)
                title = (title_m.group(1).strip() if title_m else '')
                if title == spa_title:
                    # Only keep if it was independently discovered from HTML/sitemap/JS,
                    # not from generic COMMON_PATH guessing.
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
            accepts_json=accepts_json,
            content_type=content_type,
        )
        key = f"{info.method}:{info.url}"
        if key not in self.confirmed:
            self.confirmed[key] = info

    # ------------------------------------------------------------------
    # Main
    # ------------------------------------------------------------------

    def crawl(self, max_pages: int = 60) -> List[EndpointInfo]:
        # 1. Seed from every low-cost source.
        self._add_candidate(self.base_url + '/')
        self._seed_from_robots()
        for sm in SITEMAP_CANDIDATES:
            self._seed_from_sitemap(urljoin(self.base_url + '/', sm))
        self._seed_common_paths()

        # 2. Walk HTML pages breadth-first, mining links + JS bundles.
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

        # 3. Validate every candidate — keep only resolvable endpoints.
        self._validate_candidates(max_probes=max_pages * 5)

        return list(self.confirmed.values())
