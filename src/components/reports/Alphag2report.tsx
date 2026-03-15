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
  Info
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

  useEffect(() => {
    console.log("Vulnerabilities array length:", report.vulnerabilities.length);
  }, [report]);

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "text-emerald-400";
      case "medium": return "text-amber-400";
      case "high": return "text-red-400";
      case "critical": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VULNERABLE":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Vulnerable</Badge>;
      case "SECURE":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle className="w-3 h-3" /> Secure</Badge>;
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
    if (score >= 4.0) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-green-100 text-green-700 border-green-200";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  return (
    <>
      <style type="text/css" media="print">{`
        @page {
          size: A4;
          margin: 1.5cm;
          @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10pt;
            color: #666;
          }
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          counter-reset: page;
        }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        .print-break-inside { break-inside: avoid; }
        .border, .shadow-md, .shadow-xl, .bg-card {
          border: none !important;
          box-shadow: none !important;
          background: white !important;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th { background-color: #f5f5f5; }
        h2, h3 { page-break-after: avoid; }
        .vuln-card { page-break-inside: avoid; margin-bottom: 20px; }
        .vuln-details { display: block !important; }
      `}</style>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-6 print:bg-white print:text-black print:border-0 print:shadow-none print:p-0">
        {/* Web header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
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
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1">
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Print header with logo */}
        <div className="hidden print:block mb-8">
          <div className="flex items-center justify-between border-b border-gray-300 pb-4">
            <div className="flex items-center space-x-4">
              <img src="/favicon.ico" alt="GROWHAZ Logo" className="w-12 h-12" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Alpha G2 Security Report</h1>
                <p className="text-sm text-gray-600">GROWHAZ Professional Scanner</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Report ID: {report.test_run_id.slice(0, 8)}</p>
              <p>Generated: {formatDate(report.timestamp)}</p>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Executive Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg border print:border print:border-gray-200 print:bg-gray-50">
              <p className="text-sm text-muted-foreground">Total Vulnerabilities</p>
              <p className="text-2xl font-bold">{report.summary.total_vulnerabilities}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border print:border-gray-200 print:bg-gray-50">
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className={`text-2xl font-bold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border print:border-gray-200 print:bg-gray-50">
              <p className="text-sm text-muted-foreground">Tests Blocked</p>
              <p className="text-2xl font-bold">{report.summary.blocked_tests}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border print:border-gray-200 print:bg-gray-50">
              <p className="text-sm text-muted-foreground">Average CVSS</p>
              <p className="text-2xl font-bold">
                {report.vulnerabilities.length > 0
                  ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
                  : '0.0'}
              </p>
            </div>
          </div>
        </div>

        {/* Target Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Website URL</p>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <a href={report.base_url.startsWith('http') ? report.base_url : `https://${report.base_url}`}
                 target="_blank" rel="noopener noreferrer"
                 className="text-primary hover:underline break-all">
                {report.base_url} <ExternalLink className="w-3 h-3 inline ml-1" />
              </a>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Scan Type</p>
            <p className="font-medium">Alpha G2 Professional</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Scanned At</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{formatDate(report.timestamp)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Scan ID</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">{report.test_run_id.slice(0, 8)}</code>
              <button onClick={() => copyToClipboard(report.test_run_id)} className="text-muted-foreground hover:text-primary no-print">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Test Summary Table */}
        {Object.keys(report.test_summary).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Test Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border print:border-gray-300">
                    <th className="text-left py-2 px-3">Test</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.test_summary).map(([testName, info]) => (
                    <tr key={testName} className="border-b border-border/50 print:border-gray-200">
                      <td className="py-2 px-3 font-medium">{testName}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {TEST_DESCRIPTIONS[testName] || "No description available."}
                      </td>
                      <td className="py-2 px-3">{getStatusBadge(info.status)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{info.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vulnerabilities List */}
        {report.vulnerabilities.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Vulnerabilities Found</h3>
            <div className="space-y-3">
              {report.vulnerabilities.map((vuln, idx) => {
                const showDetails = expandedVuln === idx;
                return (
                  <div key={idx} className="border border-border rounded-lg p-4 print:border print:border-gray-200 print:shadow-none print:mb-4 print:break-inside-avoid vuln-card">
                    {/* Web interactive header */}
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer no-print"
                      onClick={() => setExpandedVuln(showDetails ? null : idx)}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">{vuln.vulnerability}</span>
                          <div className="text-xs text-muted-foreground mt-1">{vuln.endpoint}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge className={`${getCVSSColor(vuln.cvss_score)} text-xs`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Static print header */}
                    <div className="hidden print:block mb-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                        <div>
                          <span className="font-bold">{vuln.vulnerability}</span>
                          <div className="text-xs text-gray-600">{vuln.endpoint}</div>
                        </div>
                        <Badge className={`${getCVSSColor(vuln.cvss_score)} text-xs ml-auto`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                      </div>
                    </div>

                    {/* Details – always visible in print, toggleable in web */}
                    <div className={`mt-3 space-y-4 ${!showDetails ? 'hidden print:block' : ''} vuln-details`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">OWASP Category</p>
                          <p className="font-medium">{vuln.owasp}</p>
                        </div>
                        {vuln.parameter && (
                          <div>
                            <p className="text-muted-foreground">Parameter</p>
                            <p className="font-medium break-all">{vuln.parameter}</p>
                          </div>
                        )}
                        {vuln.payload && (
                          <div className="col-span-1 sm:col-span-2">
                            <p className="text-muted-foreground">Payload</p>
                            <code className="mt-1 block bg-muted p-2 rounded text-xs font-mono break-all">
                              {vuln.payload}
                            </code>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-1 flex items-center gap-1">
                          <Info className="w-4 h-4 text-primary" />
                          How to Fix
                        </h4>
                        <p className="text-sm text-muted-foreground">{getRemediation(vuln)}</p>
                      </div>

                      {(vuln.raw_request || vuln.raw_response) && (
                        <div>
                          <h4 className="font-medium mb-2">Evidence</h4>
                          <div className="space-y-3">
                            {vuln.raw_request && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Request:</p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:text-gray-900">
                                  {JSON.stringify(vuln.raw_request, null, 2)}
                                </pre>
                              </div>
                            )}
                            {vuln.raw_response && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Response:</p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:text-gray-900">
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
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mr-2 text-emerald-400" />
            <span>No vulnerabilities found</span>
          </div>
        )}

        {/* Print footer (only once) */}
        <div className="hidden print:block text-xs text-center text-gray-500 mt-8 pt-4 border-t border-gray-300">
          <p>Report generated by GROWHAZ Alpha G2 Professional Scanner on {formatDate(report.timestamp)}</p>
          <p className="mt-1">This is a computer‑generated report. For queries, contact support@growhaz.com</p>
        </div>
      </div>
    </>
  );
};

export default SecurityReportComponent;
                    
