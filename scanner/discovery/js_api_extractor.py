"""
JS API Extractor — static analysis of JavaScript bundles for API endpoints.

Searches downloaded JS files for:
- fetch("...") calls
- axios.get/post/put/delete/patch("...") calls
- /api/ path strings
- GraphQL operation strings
- Next.js API routes
- Supabase / Firebase / Cloud API backend endpoints
- PostgREST table endpoints and query parameters
"""

import re
from typing import List, Set
from urllib.parse import urljoin, urlparse, parse_qs, urlunparse

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.discovery.scope import is_target_scope


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

SUPABASE_URL_RE = re.compile(r'''https://([a-zA-Z0-9_-]+)\.supabase\.co''', re.IGNORECASE)
SUPABASE_KEY_RE = re.compile(r'''eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+''')
TABLE_RE = re.compile(r'''\.from\(["']([a-zA-Z0-9_]{2,40})["']\)''')
REST_PATH_RE = re.compile(r'''/rest/v1/([a-zA-Z0-9_]{2,40})''')

SKIP_EXT = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.css', '.map',
)

CORE_TABLES = [
    "profiles", "users", "organizations", "sites", "mentors",
    "api_keys", "projects", "sessions", "orders", "documents",
    "accounts", "items", "reports", "settings"
]


def _is_valid_path(path: str) -> bool:
    """Filter out noise — only keep paths that look like real API routes."""
    if not path or len(path) < 2 or len(path) > 350:
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
    """

    def __init__(self, base_url: str, request_session=None):
        self.base_url = base_url.rstrip('/')
        self.session = request_session

    def extract_from_js(self, js_source: str) -> List[EndpointInfo]:
        """
        Extract API endpoints from a JavaScript source string.
        Returns a list of EndpointInfo objects with parsed query params, default params, and headers.
        """
        seen: Set[str] = set()
        results: List[EndpointInfo] = []

        # 1. Search for Supabase / BaaS credentials
        sb_match = SUPABASE_URL_RE.search(js_source)
        sb_url = sb_match.group(0) if sb_match else None
        key_match = SUPABASE_KEY_RE.search(js_source)
        sb_key = key_match.group(0) if key_match else ""

        api_headers = {}
        if sb_key:
            api_headers = {
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
            }

        # If Supabase backend found, extract tables and add as REST endpoints
        if sb_url:
            discovered_tables = set(TABLE_RE.findall(js_source) + REST_PATH_RE.findall(js_source))
            all_tables = set(CORE_TABLES) | discovered_tables
            for tbl in all_tables:
                rest_url = f"{sb_url}/rest/v1/{tbl}"
                key = f"GET:{rest_url}"
                if key not in seen:
                    seen.add(key)
                    results.append(EndpointInfo(
                        url=rest_url,
                        method="GET",
                        query_params=["select", "id", "user_id"],
                        default_params={"select": "*"},
                        headers=dict(api_headers),
                        discovery_source=DiscoverySource.JS_CRAWL,
                        accepts_json=True,
                    ))

        def _add(path: str, method: str = 'GET') -> None:
            if not _is_valid_path(path):
                return
            # Resolve to absolute URL
            if path.startswith('http'):
                if not is_target_scope(path, self.base_url):
                    return
                full_url = path
            else:
                full_url = urljoin(self.base_url + '/', path.lstrip('/'))

            # Parse query parameters and clean URL
            parsed = urlparse(full_url)
            clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            query_params = []
            default_params = {}
            if parsed.query:
                qs = parse_qs(parsed.query)
                query_params = list(qs.keys())
                default_params = {k: v[0] for k, v in qs.items()}

            target_url = clean_url if clean_url else full_url
            key = f"{method}:{target_url}"
            if key in seen:
                return
            seen.add(key)

            is_state_changing = method in ('POST', 'PUT', 'DELETE', 'PATCH')
            results.append(EndpointInfo(
                url=target_url,
                method=method,
                query_params=query_params,
                default_params=default_params,
                headers=dict(api_headers),
                discovery_source=DiscoverySource.JS_CRAWL,
                is_state_changing=is_state_changing,
                accepts_json=True,
            ))

        # Run all patterns
        for m in FETCH_RE.finditer(js_source):
            _add(m.group(1))
        for m in AXIOS_RE.finditer(js_source):
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
