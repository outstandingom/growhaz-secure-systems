import json
from typing import List, Dict, Any
from scanner.models.endpoint import EndpointInfo, DiscoverySource

class OpenAPILoader:
    def __init__(self, spec_data: str):
        try:
            self.spec = json.loads(spec_data)
        except json.JSONDecodeError:
            self.spec = {}

    def load(self) -> List[EndpointInfo]:
        endpoints = []
        if not self.spec or 'paths' not in self.spec:
            return endpoints

        base_path = self.spec.get('basePath', '')
        if 'servers' in self.spec and self.spec['servers']:
            base_path = self.spec['servers'][0].get('url', '')

        for path, methods in self.spec['paths'].items():
            full_path = f"{base_path}{path}"
            for method, details in methods.items():
                if method.lower() not in ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']:
                    continue
                
                method_upper = method.upper()
                params = []
                accepts_json = False
                accepts_xml = False
                
                # Extract parameters
                if 'parameters' in details:
                    for param in details['parameters']:
                        if 'name' in param:
                            params.append(param['name'])
                
                # Extract body parameters and content types
                if 'requestBody' in details and 'content' in details['requestBody']:
                    content = details['requestBody']['content']
                    if 'application/json' in content:
                        accepts_json = True
                    if 'application/xml' in content:
                        accepts_xml = True
                        
                endpoints.append(EndpointInfo(
                    url=full_path,
                    method=method_upper,
                    parameters=params,
                    discovery_source=DiscoverySource.OPENAPI,
                    accepts_json=accepts_json,
                    accepts_xml=accepts_xml,
                    state_changing=method_upper in ['POST', 'PUT', 'DELETE', 'PATCH']
                ))

        return endpoints
