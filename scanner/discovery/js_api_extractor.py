"""
JS API Extractor — static analysis of JavaScript bundles for API endpoints.

Searches downloaded JS files for:
- fetch("...") calls
- axios.get/post/put/delete/patch("...") calls
- /api/ path strings
- GraphQL operation strings
- Next.js API routes
"""

import re
from typing import List, Set
from urllib.parse import urljoin, urlparse

from scanner.models.endpoint import EndpointInfo, DiscoverySource


# Patterns for API endpoint discovery in JS source
FETCH_RE = re.compile(
    r'''fetch\s*\(\s*["`']([^"`'\s]{3,300})["`']''',
    re.IGNORECASE
)
AXIOS_RE = re.compile(
    r'''axios\s*\.\s*(?:get|post|put|delete|patch|request)\s*\(\s*["`']([^"`'\s]{3,300})["`']''',
    re.IGNORECASE
)
HTTP_RE = re.compile(
    r'''(?:http|request)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*["`']([^"`'\s]{3,300})["`']''',
    re.IGNORECASE
)
API_PATH_RE = re.compile(
    r'''["`'](\/?api\/[A-Za-z0-9_\-/.{}:?=&]{2,200})["`']'''
)
GRAPHQL_RE = re.compile(
    r'''["`'](\/graphql[^"`'\s]*)["`']'''
)
NEXT_API_RE = re.compile(
    r'''["`'](\/api\/[A-Za-z0-9_\-/.{}:]+)["`']'''
)
# Detect method near URL: {"method": "POST", "url": "/api/..."}
METHOD_URL_RE = re.compile(
    r'''"(?:method|type)"\s*:\s*"(GET|POST|PUT|DELETE|PATCH)"[^}]{0,300}["`'](\/?[A-Za-z0-9_\-/.{}:?=&]{3,200})["`']''',
    re.IGNORECASE | re.DOTALL
)

SKIP_EXT = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.css', '.map',
)


def _is_valid_path(path: str) -> bool:
    """Filter out noise — only keep paths that look like real API routes."""
    if not path or len(path) < 2 or len(path) > 250:
        return False
    if path.lower().endswith(SKIP_EXT):
        return False
    # Must start with / or http
    if not path.startswith(('/', 'http://', 'https://')):
        return False
    # No template literals left unresolved
    if '${' in path or '#{' in path:
        return False
    # No obvious noise
    noise = ('/node_modules/', '/@vite/', '/src/', '\\', ' ', '\n', '\t')
    if any(n in path for n in noise):
        return False
    return True


class JSAPIExtractor:
    """
    Extracts API endpoint URLs from JavaScript source files.

    Usage:
        extractor = JSAPIExtractor(base_url="https://example.com")
        endpoints = extractor.extract_from_js(js_source_code)
        endpoints = extractor.extract_from_urls(["https://example.com/static/js/main.chunk.js"])
    """

    def __init__(self, base_url: str, request_session=None):
        self.base_url = base_url.rstrip('/')
        self.session = request_session
        self._base_domain = urlparse(base_url).netloc.lower()

    def _same_host(self, url: str) -> bool:
        try:
            netloc = urlparse(url).netloc.lower()
            a = netloc[4:] if netloc.startswith('www.') else netloc
            b = self._base_domain[4:] if self._base_domain.startswith('www.') else self._base_domain
            return a == b or a.endswith('.' + b) or b.endswith('.' + a)
        except Exception:
            return False

    def extract_from_js(self, js_source: str) -> List[EndpointInfo]:
        """
        Extract API endpoints from a JavaScript source string.
        Returns a list of EndpointInfo objects.
        """
        seen: Set[str] = set()
        results: List[EndpointInfo] = []

        def _add(path: str, method: str = 'GET') -> None:
            if not _is_valid_path(path):
                return
            # Resolve to absolute URL
            if path.startswith('http'):
                if not self._same_host(path):
                    return
                url = path
            else:
                url = urljoin(self.base_url + '/', path.lstrip('/'))

            key = f"{method}:{url}"
            if key in seen:
                return
            seen.add(key)

            is_state_changing = method in ('POST', 'PUT', 'DELETE', 'PATCH')
            results.append(EndpointInfo(
                url=url,
                method=method,
                discovery_source=DiscoverySource.JS_CRAWL,
                is_state_changing=is_state_changing,
                accepts_json=True,
            ))

        # Run all patterns
        for m in FETCH_RE.finditer(js_source):
            _add(m.group(1))
        for m in AXIOS_RE.finditer(js_source):
            # Determine method from axios.METHOD pattern
            text = m.group(0)
            method = 'GET'
            for verb in ('post', 'put', 'delete', 'patch'):
                if f'.{verb}(' in text.lower():
                    method = verb.upper()
                    break
            _add(m.group(1), method)
        for m in HTTP_RE.finditer(js_source):
            _add(m.group(1))
        for m in API_PATH_RE.finditer(js_source):
            _add(m.group(1))
        for m in GRAPHQL_RE.finditer(js_source):
            _add(m.group(1), 'POST')
        for m in NEXT_API_RE.finditer(js_source):
            _add(m.group(1))
        for m in METHOD_URL_RE.finditer(js_source):
            method = m.group(1).upper()
            path = m.group(2)
            _add(path, method)

        return results

    def extract_from_urls(self, js_urls: List[str]) -> List[EndpointInfo]:
        """
        Download JS files and extract endpoints from each.
        Uses self.session if provided (requests.Session), else urllib.
        """
        all_results: List[EndpointInfo] = []

        for url in js_urls:
            try:
                if self.session:
                    resp = self.session.get(url, timeout=10, verify=False)
                    source = resp.text
                else:
                    import urllib.request
                    with urllib.request.urlopen(url, timeout=10) as r:
                        source = r.read().decode('utf-8', errors='replace')

                endpoints = self.extract_from_js(source)
                all_results.extend(endpoints)
            except Exception:
                continue

        return all_results
