# .github/workflows/scan.yml
name: Security Scan

on:
  workflow_dispatch:
    inputs:
      url:
        description: "Website URL to scan"
        required: true
      reportId:
        description: "Supabase report ID"
        required: true

jobs:
  scan:
    runs-on: ubuntu-latest

    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
      REPORT_ID: ${{ github.event.inputs.reportId }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.10"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install playwright
          playwright install chromium

      - name: Run security scanner
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          REPORT_ID: ${{ github.event.inputs.reportId }}
          SCAN_URL: ${{ github.event.inputs.url }}
        run: |
          python scanner/secure1.py "${{ github.event.inputs.url }}" --report-id "${{ github.event.inputs.reportId }}"

      - name: Upload report artifact
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: |
            security_report.json
            security_report.md
