# GROWHAZ Secure Systems

GROWHAZ Secure Systems is an advanced, automated web security testing platform designed to discover, analyze, and report vulnerabilities in modern web applications. The platform consists of a high-performance Python-based scanning engine and a comprehensive React dashboard for report visualization.

## Architecture

The system is built on a modern stack:
- **Backend Scanner:** Python 3.10+, Playwright for JS crawling, concurrent ThreadPool executors.
- **Frontend Dashboard:** React, TypeScript, Tailwind CSS, Vite.
- **Database / Backend-as-a-Service:** Supabase for storing scan metadata, reports, and user profiles.

## Alpha G5 vs. Legacy Scanners (G1/G2)

The **Alpha G5** and **Alpha G5 Pro** scanning engines represent a fundamental shift in how automated security testing is performed, allowing comprehensive scans to complete in **under 5 minutes**. 

### Why Alpha G5 is Better and Faster

1. **Intelligent, JS-Aware Crawling:** 
   - *Older Tools (G1/G2):* Relied heavily on static HTML parsing. They often missed API endpoints, Single Page Application (SPA) routes, and dynamic parameters. 
   - *Alpha G5:* Uses Playwright to execute JavaScript, intercept network requests, and interact with the DOM. This means it discovers the *actual* endpoints being used by the application, including complex GraphQL and REST APIs that static tools miss entirely.

2. **Evidence-Driven vs. Blind Guessing:**
   - *Older Tools:* Blindly threw thousands of payloads at every parameter, waiting for timeouts or generic errors. This was extremely slow and generated massive amounts of noise/false positives.
   - *Alpha G5:* Uses a smart "detector registry." It analyzes the parameter context first. For example, it uses *Canary Reflection* (injecting a unique string and checking if it reflects) before attempting complex XSS payloads. It uses Jaccard similarity to detect layout changes instead of relying purely on HTTP status codes. This reduces the number of required requests by orders of magnitude.

3. **Concurrency and Orchestration:**
   - *Older Tools:* Often ran sequentially or with limited thread pools, bottlenecking on network latency.
   - *Alpha G5:* Utilizes `ThreadPoolExecutor` to run multiple detectors (SQLi, XSS, IDOR, etc.) concurrently across the discovered endpoint inventory.

4. **Detailed Reporting:**
   - *Alpha G5* now captures exact test methodology, logging exactly what endpoints were discovered, what parameters were fuzzed, and how long each test took. This provides full transparency into the scan's coverage.

## Project Structure

- `scanner/` - The Python v5 scanning engine.
  - `orchestrator.py` - Manages the scan lifecycle.
  - `models/` - Data structures for endpoints, findings, and test states.
  - `detectors/` - Individual vulnerability checks (XSS, SQLi, IDOR, etc.).
  - `reporting/` - JSON, Markdown, and Supabase export logic.
- `src/` - The React frontend dashboard.
  - `components/reports/Alphag5report.tsx` - The main report visualizer component.
  - `pages/` - Application routes.

## Usage

### Running a Scan

To run a scan using the Alpha G5 engine locally:

```bash
python -m scanner.secure2 https://target-website.com --max-pages 100 --js
```

### Viewing Reports

Reports are automatically uploaded to Supabase. You can view them in the React dashboard by navigating to your profile and selecting the specific test run.

## Setup

1. Install Python dependencies:
   ```bash
   pip install requests beautifulsoup4 playwright cryptography
   playwright install
   ```
2. Install Node dependencies for the dashboard:
   ```bash
   npm install
   ```
3. Run the dashboard:
   ```bash
   npm run dev
   ```

## License
Proprietary - GROWHAZ Secure Systems.
