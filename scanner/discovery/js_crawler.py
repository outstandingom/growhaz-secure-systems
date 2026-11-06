from typing import List
from urllib.parse import urlparse, parse_qs, urlunparse
import json as _json

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine
from scanner.discovery.scope import is_target_scope

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


class JSCrawler:
    def __init__(self, base_url: str, request_engine: RequestEngine):
        self.base_url = base_url.rstrip('/')
        self.request_engine = request_engine
        self.endpoints: List[EndpointInfo] = []

    def crawl(self, max_pages: int = 100) -> List[EndpointInfo]:
        if not PLAYWRIGHT_AVAILABLE:
            return []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                ignore_https_errors=True,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = context.new_page()

            def handle_request(route, request):
                url = request.url
                method = request.method.upper()
                headers = dict(request.headers)

                # Skip static assets
                skip_ext = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.css', '.mp4')
                if url.lower().split('?', 1)[0].endswith(skip_ext):
                    route.continue_()
                    return

                # Scope check: same host or app backend API (Supabase, Firebase, custom backend)
                if not is_target_scope(url, self.base_url, headers):
                    route.continue_()
                    return

                parsed = urlparse(url)
                clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
                query_params = []
                default_params = {}
                if parsed.query:
                    qs = parse_qs(parsed.query)
                    query_params = list(qs.keys())
                    default_params = {k: v[0] for k, v in qs.items()}

                body_params = []
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
                for k, v in headers.items():
                    if k.lower() in ('apikey', 'authorization', 'x-api-key', 'content-type', 'accept'):
                        api_headers[k] = v

                self.endpoints.append(EndpointInfo(
                    url=clean_url if clean_url else url,
                    method=method,
                    query_params=query_params,
                    default_params=default_params,
                    body_params=body_params,
                    headers=api_headers,
                    discovery_source=DiscoverySource.NETWORK_INTERCEPT,
                    is_state_changing=method in ["POST", "PUT", "DELETE", "PATCH"],
                    accepts_json=True,
                ))
                route.continue_()

            context.route("**/*", handle_request)

            try:
                page.goto(self.base_url, wait_until="networkidle", timeout=25000)
            except Exception:
                try:
                    page.goto(self.base_url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    pass
            finally:
                browser.close()

        # Deduplicate
        seen = set()
        deduped = []
        for ep in self.endpoints:
            key = f"{ep.method}:{ep.url}"
            if key not in seen:
                seen.add(key)
                deduped.append(ep)
        return deduped
