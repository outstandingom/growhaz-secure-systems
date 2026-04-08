# GROWHAZ Security Testing Platform

> **Test your website security • Book expert mentors • Monetize your security tools**

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-educational-red)
![Python](https://img.shields.io/badge/python-3.8+-green)

## 🚀 Overview

GROWHAZ is a complete ecosystem for web application security:

- **Automated Security Scanner** – Professional-grade vulnerability detection (SQLi, XSS, IDOR, CORS, etc.)
- **Mentor Marketplace** – Connect with security experts for paid consultations
- **Student Tool Bazaar** – Students can build and sell their own security tools to businesses

This repository contains the core scanning engine (two versions) and the blueprint for the full platform.

---

## 🔧 Security Scanning Tools

### Version 2.4 – Optimized & Threaded
Lightweight, fast scanner for CI/CD pipelines and quick assessments.

**Features:**
- Static + JavaScript crawling (Playwright optional)
- WAF circuit breaker (stops testing after repeated blocks)
- Multithreaded XSS testing (10 workers)
- Actual parameter discovery (no blind guessing)
- Supabase integration for report storage
- Always returns exit code 0 (build never fails)

### Version 3.0 – Professional Deep Scan
Enterprise-ready scanner with stealth techniques and compliance mapping.

**New in v3.0:**
- **Deep site mapping** – 100+ endpoints, network request capture
- **Stealth mode** – Header rotation, IP spoofing, adaptive throttling (1.5–4s Gaussian delays)
- **Payload obfuscation** – Bypass simple WAFs for SQLi and XSS
- **CVSS v3.1 scoring** – Industry-standard severity metrics
- **OWASP Top 10 mapping** – Align findings with A01–A10
- **High‑fidelity evidence** – Raw requests/responses, unique test IDs
- **Enhanced circuit breaker** – Per-endpoint block tracking

### Supported Vulnerability Tests

| Test | Severity | OWASP Mapping |
|------|----------|----------------|
| SQL Injection (Boolean, Time, Error) | Critical | A03:2021 – Injection |
| Cross-Site Scripting (XSS) | Medium | A03:2021 – Injection |
| IDOR (Insecure Direct Object Reference) | High | A01:2021 – Broken Access Control |
| Directory Traversal | High | A01:2021 – Broken Access Control |
| CORS Misconfiguration | High | A05:2021 – Security Misconfiguration |
| Missing Rate Limiting | Medium | A04:2021 – Insecure Design |
| Weak Password Policy | Medium | A07:2021 – Identification Failures |
| User Enumeration | Low | A07:2021 – Identification Failures |
| Missing Security Headers | Low | A05:2021 – Security Misconfiguration |
| SSL/TLS Issues (Expired, Weak Cipher, Outdated TLS) | Medium-High | A05:2021 – Security Misconfiguration |
| CSRF / Missing Authentication | High | A07:2021 – Identification Failures |
| Open Redirect | Medium | A08:2021 – Integrity Failures |
| Sensitive Data Exposure | High | A02:2021 – Cryptographic Failures |

---

## 📦 Installation

### Prerequisites
- Python 3.8+
- pip
- (Optional) Playwright for JS crawling: `playwright install chromium`

### Clone & Setup
```bash
git clone https://github.com/yourusername/growhaz-security.git
cd growhaz-security

# Install dependencies
pip install -r requirements.txt

# For JavaScript crawling (v2.4 & v3.0)
pip install playwright
playwright install chromium
