import React, { useState, useEffect, useRef } from 'react';
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
  const printRef = useRef<HTMLDivElement>(null);

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

  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
    
    // Trigger print
    window.print();
    
    setTimeout(() => { 
      document.title = originalTitle; 
    }, 1000);
  };

  return (
    <>
      {/* Print-specific styles - completely separate from UI */}
      <style type="text/css" media="print">{`
        @page {
          size: A4;
          margin: 2cm;
        }
        
        /* Hide all web UI elements when printing */
        body * {
          visibility: hidden;
        }
        
        /* Show only the print container */
        #print-container, #print-container * {
          visibility: visible;
        }
        
        #print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
          color: black;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.5;
          padding: 0;
        }
        
        /* Print-specific styling */
        .print-cover-page {
          text-align: center;
          margin-bottom: 30px;
          page-break-after: avoid;
        }
        
        .print-cover-page h1 {
          font-size: 28pt;
          color: #1e3a8a;
          margin-bottom: 10px;
        }
        
        .print-cover-page h2 {
          font-size: 20pt;
          color: #4b5563;
          margin-bottom: 30px;
        }
        
        .print-border-line {
          border-top: 2px solid #d1d5db;
          border-bottom: 2px solid #d1d5db;
          padding: 20px;
          margin: 30px 0;
        }
        
        .print-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        
        .print-section h2 {
          font-size: 18pt;
          color: #1e3a8a;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        
        .print-section h3 {
          font-size: 14pt;
          color: #374151;
          margin: 15px 0 10px;
        }
        
        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 11pt;
        }
        
        .print-table th {
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
        }
        
        .print-table td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
        }
        
        .print-vuln-card {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }
        
        .print-risk-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10pt;
          font-weight: 500;
        }
        
        .print-risk-high {
          background-color: #fee2e2;
          color: #991b1b;
        }
        
        .print-risk-medium {
          background-color: #fef3c7;
          color: #92400e;
        }
        
        .print-risk-low {
          background-color: #d1fae5;
          color: #065f46;
        }
        
        .print-footer {
          text-align: center;
          font-size: 9pt;
          color: #6b7280;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        
        .print-page-break {
          page-break-before: always;
        }
        
        .print-avoid-break {
          page-break-inside: avoid;
        }
        
        pre {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 10px;
          font-size: 9pt;
          white-space: pre-wrap;
        }
      `}</style>

      {/* Print Container - Hidden on screen, visible only when printing */}
      <div id="print-container" style={{ display: 'none' }} aria-hidden="true">
        {/* Cover Page */}
        <div className="print-cover-page">
          <h1>Alpha G2 Security Report</h1>
          <h2>Security Assessment Report</h2>
          <div className="print-border-line">
            <p style={{ margin: '5px 0' }}>Website: {report.base_url}</p>
            <p style={{ margin: '5px 0' }}>Report ID: {report.test_run_id}</p>
            <p style={{ margin: '5px 0' }}>Date: {formatDateLong(report.timestamp)}</p>
          </div>
          <p style={{ color: '#6b7280' }}>GROWHAZ Professional Security Scanner</p>
        </div>

        {/* Table of Contents */}
        <div className="print-section print-page-break">
          <h2>Table of Contents</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ margin: '8px 0' }}>1. Executive Summary</li>
            <li style={{ margin: '8px 0' }}>2. Target Information</li>
            <li style={{ margin: '8px 0' }}>3. Test Summary</li>
            <li style={{ margin: '8px 0' }}>4. Vulnerabilities Found</li>
            <li style={{ margin: '8px 0' }}>5. Appendices</li>
            <li style={{ margin: '8px 0' }}>6. Approval</li>
          </ul>
        </div>

        {/* Executive Summary */}
        <div className="print-section">
          <h2>1. Executive Summary</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Vulnerabilities</td>
                <td><strong>{report.summary.total_vulnerabilities}</strong></td>
              </tr>
              <tr>
                <td>Risk Level</td>
                <td>
                  <span className={`print-risk-badge ${
                    report.summary.risk_level === 'high' ? 'print-risk-high' :
                    report.summary.risk_level === 'medium' ? 'print-risk-medium' : 'print-risk-low'
                  }`}>
                    {report.summary.risk_level.toUpperCase()}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Tests Blocked</td>
                <td>{report.summary.blocked_tests}</td>
              </tr>
              <tr>
                <td>Average CVSS Score</td>
                <td>
                  {report.vulnerabilities.length > 0
                    ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
                    : '0.0'}
                </td>
              </tr>
              <tr>
                <td>Scan Completed</td>
                <td>{report.summary.scan_completed ? 'Yes' : 'No'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Target Information */}
        <div className="print-section">
          <h2>2. Target Information</h2>
          <table className="print-table">
            <tbody>
              <tr>
                <th style={{ width: '30%' }}>Field</th>
                <th>Details</th>
              </tr>
              <tr>
                <td>Website URL</td>
                <td>{report.base_url}</td>
              </tr>
              <tr>
                <td>Scan Type</td>
                <td>Alpha G2 Professional Security Scan</td>
              </tr>
              <tr>
                <td>Scan Date</td>
                <td>{formatDateLong(report.timestamp)}</td>
              </tr>
              <tr>
                <td>Scan ID</td>
                <td style={{ fontFamily: 'monospace' }}>{report.test_run_id}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Test Summary */}
        {Object.keys(report.test_summary).length > 0 && (
          <div className="print-section">
            <h2>3. Test Summary</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.test_summary).map(([testName, info]) => (
                  <tr key={testName}>
                    <td>{testName}</td>
                    <td>
                      <span className={`print-risk-badge ${
                        info.status === 'VULNERABLE' ? 'print-risk-high' :
                        info.status === 'SECURE' ? 'print-risk-low' :
                        info.status === 'BLOCKED' ? 'print-risk-medium' : 'print-risk-medium'
                      }`}>
                        {info.status}
                      </span>
                    </td>
                    <td>{info.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Vulnerabilities */}
        <div className="print-section">
          <h2>4. Vulnerabilities Found</h2>
          {report.vulnerabilities.length > 0 ? (
            report.vulnerabilities.map((vuln, idx) => (
              <div key={idx} className="print-vuln-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '14pt' }}>{vuln.vulnerability}</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '10pt', color: '#4b5563', margin: 0 }}>
                      {vuln.endpoint}
                    </p>
                  </div>
                  <span className={`print-risk-badge ${
                    vuln.cvss_score >= 7 ? 'print-risk-high' :
                    vuln.cvss_score >= 4 ? 'print-risk-medium' : 'print-risk-low'
                  }`}>
                    CVSS {vuln.cvss_score}
                  </span>
                </div>
                
                <table className="print-table" style={{ margin: '10px 0' }}>
                  <tbody>
                    <tr>
                      <th style={{ width: '20%' }}>OWASP</th>
                      <td>{vuln.owasp}</td>
                    </tr>
                    {vuln.parameter && (
                      <tr>
                        <th>Parameter</th>
                        <td>{vuln.parameter}</td>
                      </tr>
                    )}
                    {vuln.payload && (
                      <tr>
                        <th>Payload</th>
                        <td><pre style={{ margin: 0 }}>{vuln.payload}</pre></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '12pt' }}>Remediation</h4>
                  <p style={{ margin: 0, padding: '10px', background: '#f9fafb', borderRadius: '4px' }}>
                    {getRemediation(vuln)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', padding: '30px', background: '#f9fafb', borderRadius: '4px' }}>
              No vulnerabilities were found during this scan.
            </p>
          )}
        </div>

        {/* Appendices */}
        <div className="print-section print-page-break">
          <h2>5. Appendices</h2>
          
          <h3>5.1 CVSS Scoring Guide</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>CVSS Score Range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="print-risk-badge print-risk-low">Low</span></td>
                <td>0.0 - 3.9</td>
              </tr>
              <tr>
                <td><span className="print-risk-badge print-risk-medium">Medium</span></td>
                <td>4.0 - 6.9</td>
              </tr>
              <tr>
                <td><span className="print-risk-badge print-risk-high">High</span></td>
                <td>7.0 - 8.9</td>
              </tr>
              <tr>
                <td><span className="print-risk-badge" style={{ backgroundColor: '#ef4444', color: 'white' }}>Critical</span></td>
                <td>9.0 - 10.0</td>
              </tr>
            </tbody>
          </table>

          <h3>5.2 Scan Configuration</h3>
          <table className="print-table">
            <tbody>
              <tr>
                <th style={{ width: '30%' }}>Scanner Version</th>
                <td>Alpha G2 Professional v2.1.0</td>
              </tr>
              <tr>
                <th>Scan Depth</th>
                <td>Standard</td>
              </tr>
              <tr>
                <th>Tests Executed</th>
                <td>{Object.keys(report.test_summary).length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Approval */}
        <div className="print-section">
          <h2>6. Approval</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Signature</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Security Team</td>
                <td>Lead Auditor</td>
                <td></td>
                <td>{formatDateLong(report.timestamp)}</td>
              </tr>
              <tr>
                <td>Client Representative</td>
                <td>System Owner</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="print-footer">
          <p>Report generated by GROWHAZ Alpha G2 Professional Scanner</p>
          <p>This is a computer-generated report. For queries, contact support@growhaz.com</p>
        </div>
      </div>

      {/* Original Web UI - Completely unchanged */}
      <div ref={printRef} className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-6">
        {/* Web header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <Printer className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Executive Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg border">
              <p className="text-sm text-muted-foreground">Total Vulnerabilities</p>
              <p className="text-2xl font-bold">{report.summary.total_vulnerabilities}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border">
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className={`text-2xl font-bold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border">
              <p className="text-sm text-muted-foreground">Tests Blocked</p>
              <p className="text-2xl font-bold">{report.summary.blocked_tests}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border">
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
              <button onClick={() => copyToClipboard(report.test_run_id)} className="text-muted-foreground hover:text-primary">
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
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Test</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.test_summary).map(([testName, info]) => (
                    <tr key={testName} className="border-b border-border/50">
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
                  <div key={idx} className="border border-border rounded-lg p-4">
                    {/* Web interactive header */}
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer"
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

                    {/* Details */}
                    <div className={`mt-3 space-y-4 ${!showDetails ? 'hidden' : ''}`}>
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
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                                  {JSON.stringify(vuln.raw_request, null, 2)}
                                </pre>
                              </div>
                            )}
                            {vuln.raw_response && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Response:</p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
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
      </div>
    </>
  );
};

export default SecurityReportComponent;
