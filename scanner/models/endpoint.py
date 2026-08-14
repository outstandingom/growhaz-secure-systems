"""
Endpoint model for the discovery/inventory system.

Each discovered endpoint stores rich metadata for intelligent test planning.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from enum import Enum


class DiscoverySource(Enum):
    """How an endpoint was discovered."""
    STATIC_CRAWL = "static_crawl"
    JS_CRAWL = "js_crawl"
    OPENAPI = "openapi"
    FORM = "form"
    NETWORK_INTERCEPT = "network_intercept"
    COMMON_PATH = "common_path"
    MANUAL = "manual"


@dataclass
class EndpointInfo:
    """Rich endpoint model for the inventory."""
    url: str
    method: str = "GET"
    query_params: List[str] = field(default_factory=list)
    path_params: List[str] = field(default_factory=list)
    body_params: List[str] = field(default_factory=list)
    json_fields: List[str] = field(default_factory=list)
    headers: Dict[str, str] = field(default_factory=dict)
    forms: List[Dict] = field(default_factory=list)
    discovery_source: DiscoverySource = DiscoverySource.STATIC_CRAWL
    auth_required: Optional[bool] = None
    content_type: str = ""
    is_state_changing: bool = False
    has_file_param: bool = False
    accepts_xml: bool = False
    accepts_json: bool = False
    is_graphql: bool = False

    @property
    def all_params(self) -> List[str]:
        """All injectable parameters from all sources."""
        return list(set(
            self.query_params + self.path_params +
            self.body_params + self.json_fields
        ))

    @property
    def key(self) -> str:
        """Unique key for deduplication: METHOD:URL"""
        return f"{self.method}:{self.url}"

    def merge(self, other: "EndpointInfo") -> "EndpointInfo":
        """Merge another endpoint's params/metadata into this one."""
        self.query_params = list(set(self.query_params + other.query_params))
        self.path_params = list(set(self.path_params + other.path_params))
        self.body_params = list(set(self.body_params + other.body_params))
        self.json_fields = list(set(self.json_fields + other.json_fields))
        self.headers.update(other.headers)
        self.forms.extend(other.forms)
        if other.auth_required is not None:
            self.auth_required = other.auth_required
        if other.content_type:
            self.content_type = other.content_type
        self.is_state_changing = self.is_state_changing or other.is_state_changing
        self.has_file_param = self.has_file_param or other.has_file_param
        self.accepts_xml = self.accepts_xml or other.accepts_xml
        self.accepts_json = self.accepts_json or other.accepts_json
        self.is_graphql = self.is_graphql or other.is_graphql
        return self

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "method": self.method,
            "query_params": self.query_params,
            "path_params": self.path_params,
            "body_params": self.body_params,
            "json_fields": self.json_fields,
            "discovery_source": self.discovery_source.value,
            "auth_required": self.auth_required,
            "content_type": self.content_type,
            "is_state_changing": self.is_state_changing,
            "has_file_param": self.has_file_param,
            "accepts_xml": self.accepts_xml,
            "accepts_json": self.accepts_json,
            "is_graphql": self.is_graphql,
        }
