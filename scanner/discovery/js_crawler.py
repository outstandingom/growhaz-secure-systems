from typing import List
from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

class JSCrawler:
    def __init__(self, base_url: str, request_engine: RequestEngine):
        self.base_url = base_url
        self.request_engine = request_engine
        self.endpoints: List[EndpointInfo] = []

    def crawl(self, max_pages: int = 100) -> List[EndpointInfo]:
        if not PLAYWRIGHT_AVAILABLE:
            print("Playwright not available. Fallback to empty JS crawl.")
            return []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            def handle_request(route, request):
                method = request.method
                url = request.url
                
                # Basic capturing of intercepted network requests
                self.endpoints.append(EndpointInfo(
                    url=url,
                    method=method,
                    discovery_source=DiscoverySource.NETWORK_INTERCEPT,
                    is_state_changing=method in ["POST", "PUT", "DELETE", "PATCH"]
                ))
                route.continue_()

            context.route("**/*", handle_request)
            
            try:
                page.goto(self.base_url, wait_until="networkidle")
                # More complex navigation could be added here
            except Exception as e:
                pass
            finally:
                browser.close()

        return self.endpoints
