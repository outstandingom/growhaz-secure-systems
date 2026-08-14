"""Detector exports."""
from .base_detector import BaseDetector, DetectorResult
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
from .registry import TEST_REGISTRY, get_detector, get_all_detectors
