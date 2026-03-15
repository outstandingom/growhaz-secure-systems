import React, { useState } from 'react';
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

// Remediation tips by vulnerability type
const REMEDIATION_TIPS: Record<string, string> = {
  "SQL Injection": "Use parameterized queries / prepared statements. Validate and sanitize all user inputs. Apply least privilege to database accounts.",
  "Cross-Site Scripting (XSS)": "Escape all user input before rendering. Use Content Security Policy (CSP). Validate input on server side.",
  "IDOR": "Implement proper access controls. Use indirect object references (e.g., random tokens). Always verify user permissions.",
  "Directory Traversal": "Use a whitelist of allowed files/paths. Normalize paths and reject any containing '../' or absolute paths.",
  "CORS Misconfiguration": "Restrict Access-Control-Allow-Origin to trusted domains only. Do not use wildcard with credentials.",
  "Missing Rate Limiting": "Implement rate limiting on authentication endpoints and sensitive operations. Use tools like express-rate-limit.",
  "Weak Password Policy": "Enforce minimum password complexity and length. Implement account lockout after failed attempts.",
  "User Enumeration": "Return generic error messages for both invalid username and password. Avoid revealing user existence.",
  "Missing Security Header": "Add recommended security headers: X-Frame-Options, CSP, HSTS, etc. Refer to OWASP Secure Headers Project.",
  "Server Version Disclosure": "Remove or obfuscate server version headers. Use a reverse proxy to strip sensitive headers.",
  "Technology Disclosure": "Remove X-Powered-By headers and other technology fingerprints. Use generic error pages.",
  "Expired SSL Certificate": "Renew SSL/TLS certificate immediately. Set up automatic renewal reminders.",
  "Weak SSL Cipher": "Disable weak ciphers and protocols (e.g., RC4, 3DES). Use strong ciphers like AES-GCM.",
  "Outdated TLS Version": "Disable TLS 1.0 and 1.1. Enable TLS 1.2 and 1.3. Update server software.",
  "CSRF / Missing Authentication": "Implement anti-CSRF tokens for state-changing requests. Require authentication for sensitive endpoints.",
  "Open Redirect": "Whitelist allowed redirect URLs. Avoid using user input to construct redirects. Validate and sanitize redirect parameters.",
  "Sensitive Data Exposure": "Do not store sensitive data in publicly accessible files. Use environment variables for secrets. Restrict file permissions."
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
  remediation?: string; // optional, if not provided we'll use generic
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
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');

  // Helper functions
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

  // Get remediation tip for a vulnerability
  const getRemediation = (vuln: Vulnerability): string => {
    if (vuln.remediation) return vuln.remediation;
    // Try to match by vulnerability type (exact or partial)
    const type = vuln.vulnerability;
    for (const [key, tip] of Object.entries(REMEDIATION_TIPS)) {
      if (type.includes(key) || key.includes(type)) {
        return tip;
      }
    }
    return "Review the vulnerability details and apply security best practices. Consult OWASP guidelines for specific recommendations.";
  };

  // PDF download (uses window.print)
  const getSanitizedUrl = (url: string) => {
    return url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  };

  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    document.title = `security-report-${getSanitizedUrl(report.base_url)}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      {/* Print styles - cleaner look */}
      <style type="text/css" media="print">{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
        /* Remove borders and shadows for print */
        .border, .border-r, .border-l, .border-t, .border-b, .shadow-md, .shadow-xl {
          border: none !important;
          box-shadow: none !important;
        }
        .bg-card, .bg-white {
          background-color: white !important;
        }
        .text-muted-foreground {
          color: #4b5563 !important;
        }
        .prose {
          max-width: none;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
        }
      `}</style>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-6 print:bg-white print:text-black print:border-0 print:shadow-none">
        {/* Header with actions (web only) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Alpha G2 Security Report
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
                <Download className="w-4 h-4" />
                Export JSON
              </Button>
            )}
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare} className="gap-1">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Print header with logo */}
        <div className="hidden print:block mb-8">
          <div className="flex items-center justify-between border-b border-gray-300 pb-4">
            <div className="flex items-center space-x-4">
              <img 
                src="/favicon.ico" 
                alt="GROWHAZ Logo" 
                className="w-12 h-12"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
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
            <div className="p-4 bg-muted/30 rounded-lg border print:border-0">
              <p className="text-sm text-muted-foreground">Total Vulnerabilities</p>
              <p className="text-2xl font-bold">{report.summary.total_vulnerabilities}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border-0">
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className={`text-2xl font-bold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border-0">
              <p className="text-sm text-muted-foreground">Tests Blocked</p>
              <p className="text-2xl font-bold">{report.summary.blocked_tests}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border print:border-0">
              <p className="text-sm text-muted-foreground">Average CVSS</p>
              <p className="text-2xl font-bold">
                {report.vulnerabilities.length > 0
                  ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
                  : '0.0'}
              </p>
            </div>
          </div>
        </div>

        {/* Basic info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Website URL</p>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <a
                href={report.base_url.startsWith('http') ? report.base_url : `https://${report.base_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {report.base_url}
                <ExternalLink className="w-3 h-3 inline ml-1" />
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
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.test_summary).map(([testName, info]) => (
                    <tr key={testName} className="border-b border-border/50 print:border-gray-200">
                      <td className="py-2 px-3 font-medium">{testName}</td>
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
                const isExpanded = expandedVuln === idx;
                return (
                  <div key={idx} className="border border-border rounded-lg p-4 print:border-0 print:shadow-none print:mb-4 print:break-inside-avoid">
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer"
                      onClick={() => setExpandedVuln(isExpanded ? null : idx)}
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
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {(isExpanded || true) && ( // Always show in print
                      <div className={`mt-3 space-y-4 ${!isExpanded ? 'hidden print:block' : ''}`}>
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

                        {/* Remediation */}
                        <div>
                          <h4 className="font-medium mb-1 flex items-center gap-1">
                            <Info className="w-4 h-4 text-primary" />
                            How to Fix
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {getRemediation(vuln)}
                          </p>
                        </div>

                        {/* Evidence (optional, can be toggled) */}
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="w-
