OWASP_MAP = {
    "sql_injection": "A03:2021-Injection",
    "xss": "A03:2021-Injection",
    "broken_auth": "A07:2021-Identification and Authentication Failures",
    "idor": "A01:2021-Broken Access Control",
    "misconfiguration": "A05:2021-Security Misconfiguration",
    "csrf": "A01:2021-Broken Access Control",
    "ssrf": "A10:2021-Server-Side Request Forgery",
    "xxe": "A05:2021-Security Misconfiguration"
}

CWE_MAP = {
    "sql_injection": "CWE-89",
    "xss": "CWE-79",
    "broken_auth": "CWE-287",
    "idor": "CWE-639",
    "misconfiguration": "CWE-16",
    "csrf": "CWE-352",
    "ssrf": "CWE-918",
    "xxe": "CWE-611"
}

REMEDIATION_MAP = {
    "sql_injection": "Use prepared statements or parameterized queries.",
    "xss": "Contextually encode all user input before rendering it on the page.",
    "broken_auth": "Implement strong authentication mechanisms and secure session management.",
    "idor": "Implement strict access controls and authorize every request.",
    "misconfiguration": "Ensure secure default configurations and remove unnecessary features.",
    "csrf": "Use anti-CSRF tokens for all state-changing operations.",
    "ssrf": "Validate and whitelist all user-supplied URLs and network requests.",
    "xxe": "Disable external entity parsing in XML parsers."
}
