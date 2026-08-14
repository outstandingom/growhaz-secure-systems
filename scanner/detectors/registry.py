"""Test Registry — ordered list of all detectors."""
from typing import Dict, List, Optional, Type
from .base_detector import BaseDetector
from .sqli_detector import SQLiDetector
from .xss_detector import XSSDetector
from .auth_detector import AuthDetector
from .idor_detector import IDORDetector
from .cors_detector import CORSDetector
from .csrf_detector import CSRFDetector
from .headers_detector import SecurityHeadersDetector
from .ssl_detector import SSLDetector
from .sensitive_data_detector import SensitiveDataDetector
from .open_redirect_detector import OpenRedirectDetector
from .traversal_detector import DirectoryTraversalDetector
from .ssrf_detector import SSRFDetector
from .ssti_detector import SSTIDetector
from .jwt_detector import JWTDetector
from .mass_assignment_detector import MassAssignmentDetector
from .xxe_detector import XXEDetector
from .error_disclosure_detector import ErrorDisclosureDetector
from .prototype_pollution_detector import PrototypePollutionDetector
from .graphql_detector import GraphQLDetector
from .smuggling_detector import SmugglingDetector
from .supply_chain_detector import SupplyChainDetector


# Ordered list of all detectors to run
TEST_REGISTRY: List[Type[BaseDetector]] = [
    # High-impact injection tests first
    SQLiDetector,
    XSSDetector,
    SSTIDetector,
    XXEDetector,
    PrototypePollutionDetector,
    SSRFDetector,
    # Access control
    AuthDetector,
    IDORDetector,
    MassAssignmentDetector,
    JWTDetector,
    CSRFDetector,
    # Configuration
    CORSDetector,
    SecurityHeadersDetector,
    SSLDetector,
    ErrorDisclosureDetector,
    GraphQLDetector,
    # Data exposure
    SensitiveDataDetector,
    OpenRedirectDetector,
    DirectoryTraversalDetector,
    # Stubs
    SmugglingDetector,
    SupplyChainDetector,
]


def get_detector(name: str) -> Optional[BaseDetector]:
    """Get a detector instance by name."""
    for cls in TEST_REGISTRY:
        det = cls()
        if det.name.lower() == name.lower():
            return det
    return None


def get_all_detectors() -> List[BaseDetector]:
    """Instantiate and return all registered detectors."""
    return [cls() for cls in TEST_REGISTRY]


def get_detectors_by_category(category: str) -> List[BaseDetector]:
    """Get all detectors in a category."""
    return [cls() for cls in TEST_REGISTRY if cls().category.lower() == category.lower()]
