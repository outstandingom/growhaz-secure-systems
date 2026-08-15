from typing import List, Dict
from scanner.models.endpoint import EndpointInfo

class EndpointInventory:
    def __init__(self):
        self._endpoints: Dict[str, EndpointInfo] = {}

    def add_endpoint(self, endpoint: EndpointInfo) -> None:
        key = f"{endpoint.method}:{endpoint.url}"
        if key not in self._endpoints:
            self._endpoints[key] = endpoint
        else:
            # Merge parameters
            existing = self._endpoints[key]
            existing.merge(endpoint)

    def add_endpoints(self, endpoints: List[EndpointInfo]) -> None:
        for ep in endpoints:
            self.add_endpoint(ep)

    def get_endpoints(self) -> List[EndpointInfo]:
        return list(self._endpoints.values())

    def get_by_method(self, method: str) -> List[EndpointInfo]:
        return [ep for ep in self._endpoints.values() if ep.method == method.upper()]

    def get_state_changing(self) -> List[EndpointInfo]:
        return [ep for ep in self._endpoints.values() if ep.is_state_changing]

    def get_with_params(self) -> List[EndpointInfo]:
        return [ep for ep in self._endpoints.values() if ep.all_params]

    def get_summary(self) -> Dict[str, int]:
        return {
            "total": len(self._endpoints),
            "get": len(self.get_by_method("GET")),
            "post": len(self.get_by_method("POST")),
            "state_changing": len(self.get_state_changing()),
            "with_params": len(self.get_with_params())
        }
