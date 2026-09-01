import re
from typing import List, Set
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine


# Common SPA/API route names we probe when the site is client-rendered.
SPA_ROUTE_HINTS = [
    '/', '/about', '/contact', '/pricing', '/blog', '/login', '/signup', '/register',
    '/auth', '/dashboard', '/profile', '/admin', '/settings', '/search',
    '/security-tools', '/development', '/seo', '/automation', '/marketing',
    '/projects', '/blockchain', '/verify-document', '/mentorship', '/wallet',
    '/terms', '/privacy-policy', '/forensic-whitepaper',
]

# High-value fingerprint / exposure paths.
EXPOSURE_PATHS = [
    '/api', '/api/v1', '/api/v2', '/graphql', '/swagger', '/swagger.json',
    '/openapi.json', '/openapi.yaml', '/api-docs',
    '/robots.txt', '/sitemap.xml', '/sitemap_index.xml', '/.well-known/security.txt',
    '/.env', '/.env.local', '/.env.production', '/.git/HEAD', '/.git/config',
    '/config.json', '/config.js', '/package.json', '/composer.json',
    '/admin', '/administrator', '/wp-admin', '/wp-login.php',
    '/login', '/register', '/health', '/healthz', '/status', '/metrics',
    '/phpinfo.php', '/info.php', '/backup.sql', '/backup.zip', '/db.sql',
    '/server-status', '/actuator', '/actuator/health', '/actuator/env',
]

# Regex to pull path-like strings out of JS bundles (routes, fetch calls).
JS_PATH_RE = re.compile(r'["\'`](/[a-zA-Z0-9_\-./]{1,120})["\'`]')
JS_URL_RE = re.compile(r'["\'`](https?://[^"\'`\s]{6,300})["\'`]')

# Skip binary/asset paths that add noise.
SKIP_EXT = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz',
    '.css', '.map',
)


class StaticCrawler:
    def __init__(self, base_url: str, request_engine: RequestEngine):
        self.base_url = base_url.rstrip('/')
        self.request_engine = request_engine
        self.visited: Set[str] = set()
        self.discovered_paths: Set[str] = set()
        self.endpoints: List[EndpointInfo] = []

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------

    def _same_host(self, url: str) -> bool:
        try:
            a = urlparse(url).netloc.lower().lstrip('www.')
            b = urlparse(self.base_url).netloc.lower().lstrip('www.')
            return a == b or a.endswith('.' + b) or b.endswith('.' + a)
        except Exception:
            return False

    def _resolved_base(self) -> str:
        """Follow one redirect on the base URL so www./apex normalisation works."""
        r = self.request_engine.request("GET", self.base_url)
        if r.has_response and r.response_evidence:
            # requests already followed redirects; grab final URL from headers/body isn't reliable,
            # so we trust self.base_url unless a Location suggests otherwise.
            pass
        return self.base_url

    def _add_endpoint(self, url: str, method: str = "GET", source: DiscoverySource = DiscoverySource.STATIC_CRAWL,
                      state_changing: bool = False, params=None, accepts_json: bool = False) -> None:
        if not url or url.lower().endswith(SKIP_EXT):
            return
        key = f"{method}:{url}"
        if key in self.discovered_paths:
            return
        self.discovered_paths.add(key)
        self.endpoints.append(EndpointInfo(
            url=url,
            method=method,
            discovery_source=source,
            is_state_changing=state_changing,
            body_params=params if state_changing else [],
            query_params=params if (params and not state_changing) else [],
            accepts_json=accepts_json,
        ))

    # -----------------------------------------------------------------
    # Discovery sources
    # -----------------------------------------------------------------

    def _seed_from_sitemap(self, sitemap_url: str, depth: int = 0) -> int:
        """Recursively parse sitemap / sitemap-index XML into endpoints."""
        if depth > 2:
            return 0
        r = self.request_engine.request("GET", sitemap_url)
        if not r.has_response or not r.body or r.status_code >= 400:
            return 0
        added = 0
        try:
            # Strip default namespace to simplify parsing.
            body = re.sub(r'\sxmlns="[^"]+"', '', r.body, count=1)
            root = ET.fromstring(body)
            tag = root.tag.lower()
            if 'sitemapindex' in tag:
                for loc in root.findall('.//loc'):
                    if loc.text:
                        added += self._seed_from_sitemap(loc.text.strip(), depth + 1)
            else:
                for loc in root.findall('.//loc'):
                    if loc.text and self._same_host(loc.text):
                        self._add_endpoint(loc.text.strip())
                        added += 1
        except ET.ParseError:
            # Fallback: pull <loc>…</loc> with regex.
            for m in re.finditer(r'<loc>\s*([^<]+?)\s*</loc>', r.body):
                url = m.group(1).strip()
                if self._same_host(url):
                    self._add_endpoint(url)
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
                    self._add_endpoint(urljoin(self.base_url + '/', path.lstrip('/')))

    def _seed_common_paths(self) -> None:
        for path in SPA_ROUTE_HINTS + EXPOSURE_PATHS:
            self._add_endpoint(urljoin(self.base_url + '/', path.lstrip('/')))

    def _extract_from_js(self, js_body: str) -> None:
        """Extract SPA routes / API paths from JS bundle content."""
        # Path strings
        for m in JS_PATH_RE.finditer(js_body):
            path = m.group(1)
            if any(path.endswith(ext) for ext in SKIP_EXT):
                continue
            if len(path) < 2 or path.startswith('//'):
                continue
            # skip likely file globs / import specifiers
            if any(bad in path for bad in ['/node_modules/', '/@', '/*.']):
                continue
            self._add_endpoint(urljoin(self.base_url + '/', path.lstrip('/')))
        # Absolute URLs
        for m in JS_URL_RE.finditer(js_body):
            url = m.group(1)
            if self._same_host(url):
                self._add_endpoint(url)

    # -----------------------------------------------------------------
    # Main crawl loop
    # -----------------------------------------------------------------

    def crawl(self, max_pages: int = 100) -> List[EndpointInfo]:
        self._resolved_base()

        # Seed: base + robots + sitemap + common paths.
        self._add_endpoint(self.base_url)
        self._seed_from_robots()
        self._seed_from_sitemap(urljoin(self.base_url + '/', 'sitemap.xml'))
        self._seed_common_paths()

        urls_to_visit: List[str] = [ep.url for ep in list(self.endpoints)]
        pages_crawled = 0
        js_scanned: Set[str] = set()

        while urls_to_visit and pages_crawled < max_pages:
            current_url = urls_to_visit.pop(0)
            if current_url in self.visited:
                continue
            self.visited.add(current_url)

            result = self.request_engine.request("GET", current_url)
            if not result.has_response or result.status_code >= 400:
                continue

            pages_crawled += 1
            content_type = (result.headers.get("Content-Type", "") or "").lower()
            body = result.body or ""

            if "application/json" in content_type:
                self._add_endpoint(current_url, accepts_json=True)
                continue

            if "javascript" in content_type or current_url.endswith('.js'):
                if current_url not in js_scanned:
                    js_scanned.add(current_url)
                    self._extract_from_js(body)
                continue

            if "html" not in content_type:
                continue

            soup = BeautifulSoup(body, 'html.parser')

            # <a href>
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                    continue
                full_url = urljoin(current_url, href).split('#', 1)[0]
                if self._same_host(full_url):
                    if full_url not in self.visited and full_url not in urls_to_visit:
                        urls_to_visit.append(full_url)
                    self._add_endpoint(full_url)

            # <script src> — fetch and mine JS bundles for routes/API paths.
            for script in soup.find_all('script', src=True):
                src = script['src']
                if not src or src.startswith(('javascript:', 'data:')):
                    continue
                js_url = urljoin(current_url, src)
                if not self._same_host(js_url) or js_url in js_scanned:
                    continue
                js_scanned.add(js_url)
                self._add_endpoint(js_url)
                js_res = self.request_engine.request("GET", js_url)
                if js_res.has_response and js_res.status_code < 400 and js_res.body:
                    self._extract_from_js(js_res.body)

            # <form>
            for form in soup.find_all('form'):
                action = form.get('action', '') or current_url
                method = (form.get('method', 'GET') or 'GET').upper()
                form_url = urljoin(current_url, action)
                inputs = form.find_all(['input', 'select', 'textarea'])
                params = [inp.get('name') for inp in inputs if inp.get('name')]
                state_changing = method in ('POST', 'PUT', 'DELETE', 'PATCH')
                self._add_endpoint(
                    form_url,
                    method=method,
                    source=DiscoverySource.FORM,
                    state_changing=state_changing,
                    params=params,
                )

        return self.endpoints
