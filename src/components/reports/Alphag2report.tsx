import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  Share2,
  Clock,
  Target,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Info,
  Printer
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Test descriptions
const TEST_DESCRIPTIONS: Record<string, string> = {
  "SQL Injection": "Tests for SQL injection using boolean, time‑based, and error‑based payloads.",
  "Cross-Site Scripting (XSS)": "Injects script payloads to detect reflected XSS.",
  "Authentication Flaws": "Checks weak passwords, user enumeration, and rate limiting.",
  "IDOR": "Attempts to access other users' data by manipulating IDs.",
  "CORS Misconfiguration": "Verifies unsafe cross‑origin configurations.",
  "Sensitive Data Exposure": "Scans for publicly accessible .env, config, backups.",
  "Security Headers": "Validates X‑Frame‑Options, CSP, HSTS, etc.",
  "SSL/TLS Vulnerabilities": "Analyses certificate expiry, weak ciphers, old protocols.",
  "CSRF": "Tests if state‑changing endpoints work without authentication.",
  "Open Redirect": "Injects malicious URLs to test for unvalidated redirects.",
  "Directory Traversal": "Attempts to read files outside the web root."
};

// Remediation tips
const REMEDIATION_TIPS: Record<string, string> = {
  "SQL Injection": "Use parameterized queries. Validate all inputs. Apply least privilege.",
  "Cross-Site Scripting (XSS)": "Escape output. Use CSP. Validate on server side.",
  "IDOR": "Implement proper access controls. Use indirect references.",
  "Directory Traversal": "Whitelist allowed paths. Normalise and reject '../'.",
  "CORS Misconfiguration": "Restrict Access-Control-Allow-Origin to trusted domains.",
  "Missing Rate Limiting": "Add rate limiting (e.g., express-rate-limit).",
  "Weak Password Policy": "Enforce complexity and length. Implement account lockout.",
  "User Enumeration": "Return generic error messages for both valid/invalid users.",
  "Missing Security Header": "Add headers: X-Frame-Options, CSP, HSTS, etc.",
  "Server Version Disclosure": "Remove or obfuscate server version headers.",
  "Technology Disclosure": "Remove X-Powered-By and similar fingerprints.",
  "Expired SSL Certificate": "Renew immediately; set up auto‑renewal.",
  "Weak SSL Cipher": "Disable RC4, 3DES; use AES‑GCM.",
  "Outdated TLS Version": "Disable TLS 1.0/1.1; enable TLS 1.2/1.3.",
  "CSRF / Missing Authentication": "Require auth and anti‑CSRF tokens.",
  "Open Redirect": "Whitelist allowed redirect URLs.",
  "Sensitive Data Exposure": "Store secrets in environment variables, not public files."
};

interface Vulnerability {
  vulnerability: string;
  endpoint: string;
  cvss_score: number;
  owasp: string;
  test_run_id: string;
  timestamp: string;
  payload?: string;
  parameter?: string;
  raw_request?: any;
  raw_response?: any;
  remediation?: string;
}

interface TestSummary {
  [key: string]: {
    status: 'VULNERABLE' | 'SECURE' | 'BLOCKED' | 'ERROR';
    details: string;
  };
}

interface SecurityReport {
  base_url: string;
  test_run_id: string;
  timestamp: string;
  vulnerabilities: Vulnerability[];
  test_summary: TestSummary;
  summary: {
    total_vulnerabilities: number;
    risk_level: 'low' | 'medium' | 'high';
    scan_completed: boolean;
    blocked_tests: number;
  };
}

interface SecurityReportProps {
  report: SecurityReport;
  onExport?: () => void;
  onShare?: () => void;
}

const SecurityReportComponent: React.FC<SecurityReportProps> = ({ report, onExport, onShare }) => {
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [currentDate] = useState(new Date());

  useEffect(() => {
    console.log("Vulnerabilities array length:", report.vulnerabilities.length);
  }, [report]);

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "text-emerald-600 dark:text-emerald-400";
      case "medium": return "text-amber-600 dark:text-amber-400";
      case "high": return "text-red-600 dark:text-red-400";
      case "critical": return "text-red-700 dark:text-red-500";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "medium": return "bg-amber-100 text-amber-800 border-amber-200";
      case "high": return "bg-red-100 text-red-800 border-red-200";
      case "critical": return "bg-red-200 text-red-900 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VULNERABLE":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Vulnerable</Badge>;
      case "SECURE":
        return <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle className="w-3 h-3" /> Secure</Badge>;
      case "BLOCKED":
        return <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" /> Blocked</Badge>;
      case "ERROR":
        return <Badge variant="outline" className="text-destructive border-destructive/30 gap-1"><AlertTriangle className="w-3 h-3" /> Error</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getCVSSColor = (score: number) => {
    if (score >= 7.0) return "bg-red-100 text-red-700 border-red-200";
    if (score >= 4.0) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  };

  const getCVSSTextColor = (score: number) => {
    if (score >= 7.0) return "text-red-700 dark:text-red-400";
    if (score >= 4.0) return "text-amber-700 dark:text-amber-400";
    return "text-emerald-700 dark:text-emerald-400";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRemediation = (vuln: Vulnerability): string => {
    if (vuln.remediation) return vuln.remediation;
    const type = vuln.vulnerability;
    for (const [key, tip] of Object.entries(REMEDIATION_TIPS)) {
      if (type.includes(key) || key.includes(type)) return tip;
    }
    return "Apply security best practices. See OWASP guidelines.";
  };

  const getSanitizedUrl = (url: string) => url.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    document.title = `security-report-${getSanitizedUrl(report.base_url)}`;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 1000);
  };

  // Calculate average CVSS
  const averageCVSS = report.vulnerabilities.length > 0
    ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
    : '0.0';

  return (
    <>
      <style type="text/css" media="print">{`
        @page {
          size: A4;
          margin: 2cm;
          @top-center {
            content: "Alpha G2 Security Report";
            font-size: 9pt;
            color: #666;
          }
          @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 9pt;
            color: #666;
          }
        }
        
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.5;
          color: #1a1a1a;
          background: white;
          counter-reset: page;
        }
        
        .no-print { 
          display: none !important; 
        }
        
        .print-only { 
          display: block !important; 
        }
        
        .print-break-inside { 
          break-inside: avoid; 
        }
        
        .print-page-break {
          page-break-before: always;
        }
        
        .print-page-break-avoid {
          page-break-after: avoid;
        }
        
        /* Reset all background colors for better printing */
        .bg-card, .bg-muted, .bg-gray-50, .bg-gray-100, .bg-gray-900 {
          background: white !important;
          background-color: white !important;
        }
        
        /* Keep badge colors but ensure they print */
        .bg-red-100, .bg-amber-100, .bg-emerald-100, .bg-blue-100 {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Table styles */
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-size: 10pt;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        
        th {
          background-color: #f8f9fa !important;
          font-weight: 600;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Section headers */
        h2, h3, h4 {
          page-break-after: avoid;
        }
        
        h2 {
          font-size: 16pt;
          color: #1e40af;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 4px;
          margin-top: 24px;
          margin-bottom: 16px;
        }
        
        h3 {
          font-size: 14pt;
          color: #374151;
          margin-top: 20px;
          margin-bottom: 12px;
        }
        
        /* Vulnerability cards */
        .vuln-card { 
          page-break-inside: avoid; 
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 16px;
        }
        
        .vuln-details { 
          display: block !important; 
          margin-top: 12px;
        }
        
        /* Executive summary cards */
        .summary-card {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 12px;
          background: #fafafa !important;
        }
        
        /* Code blocks */
        pre {
          background: #f4f4f5 !important;
          color: #1f2937 !important;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px;
          font-size: 9pt;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        /* Links */
        a {
          color: #2563eb;
          text-decoration: none;
        }
        
        /* Cover page */
        .cover-page {
          text-align: center;
          margin-bottom: 40px;
          page-break-after: avoid;
        }
        
        .cover-page h1 {
          font-size: 24pt;
          color: #1e3a8a;
          margin-bottom: 8px;
        }
        
        .cover-page .subtitle {
          font-size: 18pt;
          color: #4b5563;
          margin-bottom: 32px;
        }
        
        .cover-page .border-line {
          border-top: 2px solid #d1d5db;
          border-bottom: 2px solid #d1d5db;
          padding: 16px;
          margin: 24px 0;
        }
        
        /* Table of contents */
        .toc {
          margin-bottom: 32px;
        }
        
        .toc ul {
          list-style-type: none;
          padding-left: 0;
        }
        
        .toc li {
          margin-bottom: 4px;
        }
        
        .toc a {
          color: #2563eb;
          text-decoration: none;
        }
      `}</style>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-8 print:border-0 print:shadow-none print:p-0 print:space-y-6">
        {/* Web Header with Print Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <h2 className="text-xl font-bold flex items-center gap-2 text-blue-800">
            <Shield className="w-5 h-5 text-blue-600" />
            Alpha G2 Security Report
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
                <Download className="w-4 h-4" /> Export JSON
              </Button>
            )}
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare} className="gap-1">
                <Share2 className="w-4 h-4" /> Share
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleDownloadPDF} className="gap-1 bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4" /> Print / PDF
            </Button>
          </div>
        </div>

        {/* Cover Page */}
        <div className="cover-page print:block">
          <h1 className="text-3xl font-bold text-blue-800 mb-2">Alpha G2 Security Report</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Security Assessment Report</h2>
          <div className="border-t-2 border-b-2 border-gray-200 py-6 my-8">
            <p className="text-gray-600 mb-2">Prepared for: {report.base_url}</p>
            <p className="text-gray-600 mb-2">Report ID: {report.test_run_id}</p>
            <p className="text-gray-600">Date: {formatDate(report.timestamp)}</p>
          </div>
          <p className="text-sm text-gray-500">GROWHAZ Professional Security Scanner</p>
        </div>

        {/* Table of Contents - Print Only */}
        <div className="hidden print:block toc print-page-break-avoid">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4">Table of Contents</h2>
          <ul className="space-y-1">
            <li><a href="#executive-summary">1. Executive Summary</a></li>
            <li><a href="#target-information">2. Target Information</a></li>
            <li><a href="#test-summary">3. Test Summary</a></li>
            <li><a href="#vulnerabilities-found">4. Vulnerabilities Found</a></li>
            <li><a href="#appendices">5. Appendices</a></li>
          </ul>
        </div>

        {/* Executive Summary */}
        <section id="executive-summary" className="print-page-break-avoid">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Executive Summary
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="summary-card">
              <p className="text-sm text-gray-600 mb-1">Total Vulnerabilities</p>
              <p className="text-3xl font-bold text-gray-900">{report.summary.total_vulnerabilities}</p>
            </div>
            <div className="summary-card">
              <p className="text-sm text-gray-600 mb-1">Risk Level</p>
              <p className={`text-3xl font-bold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </p>
            </div>
            <div className="summary-card">
              <p className="text-sm text-gray-600 mb-1">Tests Blocked</p>
              <p className="text-3xl font-bold text-gray-900">{report.summary.blocked_tests}</p>
            </div>
            <div className="summary-card">
              <p className="text-sm text-gray-600 mb-1">Average CVSS</p>
              <p className={`text-3xl font-bold ${getCVSSTextColor(parseFloat(averageCVSS))}`}>
                {averageCVSS}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 print:bg-gray-50 print:border-gray-300">
            <h3 className="font-semibold text-gray-800 mb-2">Risk Assessment</h3>
            <p className="text-sm text-gray-600">
              This security assessment identified <span className="font-bold">{report.summary.total_vulnerabilities}</span> vulnerabilities 
              with an overall risk level of <span className={`font-bold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </span>. 
              {report.summary.total_vulnerabilities > 0 
                ? " Immediate remediation is recommended for high-severity issues."
                : " No vulnerabilities were detected during this scan."}
            </p>
          </div>
        </section>

        {/* Target Information */}
        <section id="target-information" className="print-page-break-avoid">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4">Target Information</h2>
          
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-semibold w-1/3 py-2">Website URL</td>
                <td className="py-2">
                  <a href={report.base_url.startsWith('http') ? report.base_url : `https://${report.base_url}`}
                     target="_blank" rel="noopener noreferrer"
                     className="text-blue-600 hover:underline print:text-black print:no-underline">
                    {report.base_url}
                  </a>
                </td>
              </tr>
              <tr>
                <td className="font-semibold py-2">Scan Type</td>
                <td className="py-2">Alpha G2 Professional Security Scan</td>
              </tr>
              <tr>
                <td className="font-semibold py-2">Scan Date</td>
                <td className="py-2">{formatDate(report.timestamp)}</td>
              </tr>
              <tr>
                <td className="font-semibold py-2">Scan ID</td>
                <td className="py-2 font-mono text-xs">{report.test_run_id}</td>
              </tr>
              <tr>
                <td className="font-semibold py-2">Scan Completed</td>
                <td className="py-2">{report.summary.scan_completed ? 'Yes' : 'No'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Test Summary */}
        {Object.keys(report.test_summary).length > 0 && (
          <section id="test-summary" className="print-page-break-avoid">
            <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4">Test Summary</h2>
            
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-100 font-semibold">Test</th>
                  <th className="bg-gray-100 font-semibold">Description</th>
                  <th className="bg-gray-100 font-semibold">Status</th>
                  <th className="bg-gray-100 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.test_summary).map(([testName, info]) => (
                  <tr key={testName}>
                    <td className="font-medium">{testName}</td>
                    <td className="text-xs text-gray-600">{TEST_DESCRIPTIONS[testName] || "No description available."}</td>
                    <td>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        info.status === 'VULNERABLE' ? 'bg-red-100 text-red-800' :
                        info.status === 'SECURE' ? 'bg-emerald-100 text-emerald-800' :
                        info.status === 'BLOCKED' ? 'bg-gray-100 text-gray-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {info.status}
                      </span>
                    </td>
                    <td className="text-xs text-gray-600">{info.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Vulnerabilities Found */}
        <section id="vulnerabilities-found">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4">Vulnerabilities Found</h2>
          
          {report.vulnerabilities.length > 0 ? (
            <div className="space-y-4">
              {report.vulnerabilities.map((vuln, idx) => {
                const showDetails = expandedVuln === idx;
                return (
                  <div key={idx} className="vuln-card">
                    {/* Web Interactive Header */}
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer no-print"
                      onClick={() => setExpandedVuln(showDetails ? null : idx)}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-gray-900">{vuln.vulnerability}</span>
                          <div className="text-xs text-gray-500 mt-1 font-mono break-all">{vuln.endpoint}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge className={`${getCVSSColor(vuln.cvss_score)} text-xs font-medium`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Print Header */}
                    <div className="hidden print:block mb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">{vuln.vulnerability}</h3>
                          <p className="text-xs text-gray-600 font-mono mt-1">{vuln.endpoint}</p>
                        </div>
                        <Badge className={`${getCVSSColor(vuln.cvss_score)} text-xs font-medium ml-4`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                      </div>
                    </div>

                    {/* Details */}
                    <div className={`mt-4 space-y-4 ${!showDetails ? 'hidden print:block' : ''} vuln-details`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">OWASP Category</p>
                          <p className="font-medium text-gray-900">{vuln.owasp}</p>
                        </div>
                        {vuln.parameter && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parameter</p>
                            <p className="font-medium text-gray-900 break-all">{vuln.parameter}</p>
                          </div>
                        )}
                      </div>

                      {vuln.payload && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Payload</p>
                          <code className="block bg-gray-50 p-3 rounded border border-gray-200 text-xs font-mono break-all">
                            {vuln.payload}
                          </code>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Remediation</h4>
                        <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                          {getRemediation(vuln)}
                        </p>
                      </div>

                      {(vuln.raw_request || vuln.raw_response) && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Technical Evidence</h4>
                          <div className="space-y-3">
                            {vuln.raw_request && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Request:</p>
                                <pre className="bg-gray-50 p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                                  {JSON.stringify(vuln.raw_request, null, 2)}
                                </pre>
                              </div>
                            )}
                            {vuln.raw_response && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Response:</p>
                                <pre className="bg-gray-50 p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                                  {JSON.stringify(vuln.raw_response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <CheckCircle className="w-8 h-8 mr-2 text-emerald-500" />
              <span className="text-gray-600 font-medium">No vulnerabilities were found during this scan</span>
            </div>
          )}
        </section>

        {/* Appendices */}
        <section id="appendices" className="print-page-break-avoid">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-4">Appendices</h2>
          
          <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">A. CVSS Scoring Guide</h3>
          <table className="w-full text-sm mb-6">
            <thead>
              <tr>
                <th className="bg-gray-100">Severity</th>
                <th className="bg-gray-100">CVSS Score Range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="text-emerald-600 font-medium">Low</span></td>
                <td>0.0 - 3.9</td>
              </tr>
              <tr>
                <td><span className="text-amber-600 font-medium">Medium</span></td>
                <td>4.0 - 6.9</td>
              </tr>
              <tr>
                <td><span className="text-red-600 font-medium">High</span></td>
                <td>7.0 - 8.9</td>
              </tr>
              <tr>
                <td><span className="text-red-700 font-medium">Critical</span></td>
                <td>9.0 - 10.0</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">B. Scan Configuration</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-semibold w-1/3">Scanner Version</td>
                <td>Alpha G2 Professional v2.1.0</td>
              </tr>
              <tr>
                <td className="font-semibold">Scan Depth</td>
                <td>Standard</td>
              </tr>
              <tr>
                <td className="font-semibold">Test Categories</td>
                <td>{Object.keys(report.test_summary).length} tests executed</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Approval Section */}
        <section className="mt-8 print-page-break-avoid">
          <h2 className="text-xl font-bold text-blue-800 border-b border-blue-200 pb-2 mb-6">Approval</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="bg-gray-100">Name</th>
                <th className="bg-gray-100">Role</th>
                <th className="bg-gray-100">Signature</th>
                <th className="bg-gray-100">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Security Team</td>
                <td>Lead Auditor</td>
                <td></td>
                <td>{formatDateShort(report.timestamp)}</td>
              </tr>
              <tr>
                <td>Client Representative</td>
                <td>System Owner</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Footer */}
        <div className="hidden print:block text-xs text-center text-gray-500 mt-8 pt-4 border-t border-gray-300">
          <p>Report generated by GROWHAZ Alpha G2 Professional Scanner</p>
          <p className="mt-1">This is a computer-generated report. For queries, contact support@growhaz.com</p>
        </div>
      </div>
    </>
  );
};

export default SecurityReportComponent;
