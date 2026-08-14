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
        urls_to_visit = [self.base_url]
        pages_crawled = 0
        
        # Add common API paths to probe
        common_paths = ['/api', '/api/v1', '/graphql', '/swagger', '/openapi.json']
        for path in common_paths:
            urls_to_visit.append(urljoin(self.base_url, path))
            
        while urls_to_visit and pages_crawled < max_pages:
            current_url = urls_to_visit.pop(0)
            if current_url in self.visited:
                continue
                
            self.visited.add(current_url)
            
            result = self.request_engine.send_request("GET", current_url)
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
                        state_changing=False
                    ))
                    continue
                
                # Parse HTML
                if "text/html" in content_type and result.text:
                    soup = BeautifulSoup(result.text, 'html.parser')
                    
                    # Extract links
                    for a_tag in soup.find_all('a', href=True):
                        href = a_tag['href']
                        if not href or href.startswith(('javascript:', 'mailto:', 'tel:')):
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
                                state_changing=False
                            ))
                            
                    # Extract forms
                    for form in soup.find_all('form'):
                        action = form.get('action', '')
                        method = form.get('method', 'GET').upper()
                        form_url = urljoin(current_url, action)
                        
                        inputs = form.find_all(['input', 'select', 'textarea'])
                        params = {inp.get('name'): "" for inp in inputs if inp.get('name')}
                        
                        state_changing = method in ['POST', 'PUT', 'DELETE', 'PATCH']
                        
                        self.endpoints.append(EndpointInfo(
                            url=form_url,
                            method=method,
                            parameters=list(params.keys()),
                            discovery_source=DiscoverySource.STATIC_CRAWL,
                            state_changing=state_changing
                        ))
                        
        return self.endpoints
