import re
from typing import List, Set, Dict, Any
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from scanner.models.endpoint import EndpointInfo, DiscoverySource
from scanner.engine.request_engine import RequestEngine

class StaticCrawler:
    def __init__(self, base_url: str, request_engine: RequestEngine):
        self.base_url = base_url
        self.request_engine = request_engine
        self.visited: Set[str] = set()
        self.endpoints: List[EndpointInfo] = []
        
    def crawl(self, max_pages: int = 100) -> List[EndpointInfo]:
        # Always ensure base URL is included as the primary endpoint
        base_endpoint = EndpointInfo(
            url=self.base_url,
            method="GET",
            discovery_source=DiscoverySource.STATIC_CRAWL,
            is_state_changing=False
        )
        self.endpoints.append(base_endpoint)

        urls_to_visit = [self.base_url]
        pages_crawled = 0
        
        # High-value path wordlist to probe for endpoints and sensitive exposures
        common_paths = [
            '/api', '/api/v1', '/graphql', '/swagger', '/swagger.json', '/openapi.json',
            '/robots.txt', '/sitemap.xml', '/.well-known/security.txt',
            '/.env', '/.git/HEAD', '/config.json', '/admin', '/login', '/register',
            '/health', '/status', '/phpinfo.php', '/backup.sql', '/wp-login.php'
        ]
        for path in common_paths:
            urls_to_visit.append(urljoin(self.base_url, path))
            
        while urls_to_visit and pages_crawled < max_pages:
            current_url = urls_to_visit.pop(0)
            if current_url in self.visited:
                continue
                
            self.visited.add(current_url)
            
            result = self.request_engine.request("GET", current_url)
            if result.status_code and result.status_code < 400:
                pages_crawled += 1
                content_type = result.headers.get("Content-Type", "")
                
                # Check if it's an API endpoint based on content type
                if "application/json" in content_type:
                    self.endpoints.append(EndpointInfo(
                        url=current_url,
                        method="GET",
                        discovery_source=DiscoverySource.STATIC_CRAWL,
                        accepts_json=True,
                        is_state_changing=False
                    ))
                    continue
                
                # Parse HTML for links, scripts, and forms
                if "text/html" in content_type and result.body:
                    soup = BeautifulSoup(result.body, 'html.parser')
                    
                    # Extract links (<a href>)
                    for a_tag in soup.find_all('a', href=True):
                        href = a_tag['href']
                        if not href or href.startswith(('javascript:', 'mailto:', 'tel:', '#')):
                            continue
                        full_url = urljoin(current_url, href)
                        
                        # Only follow links in same domain
                        if urlparse(full_url).netloc == urlparse(self.base_url).netloc:
                            if full_url not in self.visited and full_url not in urls_to_visit:
                                urls_to_visit.append(full_url)
                            
                            self.endpoints.append(EndpointInfo(
                                url=full_url,
                                method="GET",
                                discovery_source=DiscoverySource.STATIC_CRAWL,
                                is_state_changing=False
                            ))

                    # Extract script assets (<script src>)
                    for script in soup.find_all('script', src=True):
                        src = script['src']
                        if src and not src.startswith(('javascript:', 'data:')):
                            full_js_url = urljoin(current_url, src)
                            if urlparse(full_js_url).netloc == urlparse(self.base_url).netloc:
                                self.endpoints.append(EndpointInfo(
                                    url=full_js_url,
                                    method="GET",
                                    discovery_source=DiscoverySource.STATIC_CRAWL,
                                    is_state_changing=False
                                ))
                            
                    # Extract forms (<form>)
                    for form in soup.find_all('form'):
                        action = form.get('action', '')
                        method = form.get('method', 'GET').upper()
                        form_url = urljoin(current_url, action)
                        
                        inputs = form.find_all(['input', 'select', 'textarea'])
                        params = [inp.get('name') for inp in inputs if inp.get('name')]
                        
                        is_state_changing = method in ['POST', 'PUT', 'DELETE', 'PATCH']
                        
                        self.endpoints.append(EndpointInfo(
                            url=form_url,
                            method=method,
                            body_params=params if is_state_changing else [],
                            query_params=params if not is_state_changing else [],
                            discovery_source=DiscoverySource.FORM,
                            is_state_changing=is_state_changing
                        ))
                        
        return self.endpoints
