import { useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom"; // needed for rendering into new window
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Download, X, FileImage, File,
  Shield, AlertTriangle, CheckCircle, XCircle, AlertCircle,
  Share2, Clock, Globe, ChevronDown, ChevronUp,
  Copy, ExternalLink, Info
} from "lucide-react";
import { jsPDF } from "jspdf";

// ----------------------------------------------------------------------
// Types and constants from the security report component
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Helper functions (from original converter + new ones)
// ----------------------------------------------------------------------
type ConvertState = "idle" | "selected" | "converting" | "ready" | "jsonPreview";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
];

const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.txt,.csv,.md,.json";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(type: string) {
  if (type === "application/json") return <FileText className="h-8 w-8 text-accent" />;
  if (type.startsWith("image/")) return <FileImage className="h-8 w-8 text-accent" />;
  return <FileText className="h-8 w-8 text-accent" />;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getSanitizedUrl(url: string) {
  return url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
}

// ----------------------------------------------------------------------
// SecurityReportComponent (embedded, with print styles)
// ----------------------------------------------------------------------
interface SecurityReportProps {
  report: SecurityReport;
  onExport?: () => void;
  onShare?: () => void;
}

const SecurityReportComponent: React.FC<SecurityReportProps> = ({ report, onExport, onShare }) => {
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);

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
            {/* The internal PDF button is kept, but it won't be used in the main flow; we'll use our own outside */}
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
          <div className="text-center py-8 text-muted-foreground">No vulnerabilities found.</div>
        )}
      </div>
    </>
  );
};

// ----------------------------------------------------------------------
// Main FileToPdfConverter (enhanced with JSON support)
// ----------------------------------------------------------------------
export default function FileToPdfConverter() {
  const [state, setState] = useState<ConvertState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jsonReport, setJsonReport] = useState<SecurityReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setState("idle");
    setProgress(0);
    setPdfBlob(null);
    setJsonReport(null);
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPdfBlob(null);
    setProgress(0);
    setJsonReport(null);

    if (f.type === "application/json" || f.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const report = JSON.parse(e.target?.result as string);
          // Basic validation: check for required fields
          if (report && report.base_url && Array.isArray(report.vulnerabilities) && report.summary) {
            setJsonReport(report as SecurityReport);
            setState("jsonPreview");
          } else {
            alert("Invalid JSON structure: not a valid security report.");
            reset();
          }
        } catch {
          alert("Invalid JSON file.");
          reset();
        }
      };
      reader.readAsText(f);
    } else {
      setState("selected");
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const convert = async () => {
    if (!file) return;
    setState("converting");
    setProgress(10);

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;

      if (file.type.startsWith("image/")) {
        setProgress(30);
        const dataUrl = await readAsDataUrl(file);
        setProgress(60);

        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((res) => { img.onload = () => res(); });

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(maxW / w, maxH / h, 1);
        w *= scale;
        h *= scale;

        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        doc.addImage(dataUrl, "JPEG", x, y, w, h);
        setProgress(90);
      } else {
        // Text-based files
        setProgress(30);
        const text = await file.text();
        setProgress(50);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, pageW - margin * 2);
        const lineHeight = 16;
        let y = margin;

        for (let i = 0; i < lines.length; i++) {
          if (y + lineHeight > pageH - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(lines[i], margin, y);
          y += lineHeight;
        }
        setProgress(90);
      }

      const blob = doc.output("blob");
      setPdfBlob(blob);
      setProgress(100);
      setState("ready");
    } catch {
      setState("selected");
      setProgress(0);
    }
  };

  const download = () => {
    if (!pdfBlob || !file) return;
    const name = file.name.replace(/\.[^.]+$/, "") + ".pdf";
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fixed PDF download for JSON reports using a new window
  const downloadJsonPdf = () => {
    if (!jsonReport) return;

    // Open a blank window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to generate the PDF.');
      return;
    }

    // Write a basic HTML document with Tailwind CDN and a mount point
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Security Report - ${getSanitizedUrl(jsonReport.base_url)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            /* Hide interactive buttons on screen; they will be hidden in print anyway */
            .no-print { display: none; }
            /* Ensure the report takes full width */
            body { background: white; padding: 1rem; }
            #report-root { max-width: 1200px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div id="report-root"></div>
        </body>
      </html>
    `);
    printWindow.document.close();

    // Render the React component into the new window's root div
    const rootDiv = printWindow.document.getElementById('report-root');
    if (rootDiv) {
      ReactDOM.render(
        <SecurityReportComponent report={jsonReport} />,
        rootDiv,
        () => {
          // Once rendered, trigger print after a short delay to ensure styles are applied
          setTimeout(() => {
            printWindow.print();
            // Optionally close the window after print (user may want to keep it)
            // printWindow.close();
          }, 500);
        }
      );
    }
  };

  return (
    <Card
      className="w-full max-w-md mx-auto border-0 shadow-xl transition-all duration-200"
      style={{ borderRadius: "var(--radius)" }}
    >
      <CardContent className="p-6">
        {state === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors duration-200 ${
              isDragging
                ? "border-accent bg-accent/10"
                : "border-muted-foreground/25 hover:border-accent hover:bg-accent/5"
            }`}
            style={{ minHeight: 200 }}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                Drop file here or tap to select
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                JPG, PNG, WEBP, TXT, CSV, MD, JSON
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={onInputChange}
            />
          </div>
        )}

        {(state === "selected" || state === "converting") && file && !jsonReport && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                onClick={reset}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Remove file"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {state === "converting" && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2 [&>div]:bg-accent" />
                <p className="text-xs text-muted-foreground text-center">
                  Converting… {progress}%
                </p>
              </div>
            )}

            {state === "selected" && (
              <Button
                onClick={convert}
                className="w-full h-12 text-base font-semibold"
              >
                Convert to PDF
              </Button>
            )}
          </div>
        )}

        {state === "jsonPreview" && jsonReport && (
          <div className="space-y-4">
            <div className="flex items-center justify-between no-print">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Security Report Preview
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="gap-1"
              >
                <X className="w-4 h-4" /> New file
              </Button>
            </div>

            {/* Render the full report component directly (no scroll wrapper) */}
            <SecurityReportComponent report={jsonReport} />

            <div className="flex justify-end no-print">
              <Button onClick={downloadJsonPdf} className="gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          </div>
        )}

        {state === "ready" && file && (
          <div className="flex flex-col items-center gap-5">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <File className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                PDF Ready!
              </p>
              <p className="text-sm text-muted-foreground">
                {file.name.replace(/\.[^.]+$/, "")}.pdf
              </p>
            </div>
            <Button
              onClick={download}
              className="w-full h-12 text-base font-semibold animate-pulse"
            >
              <Download className="h-5 w-5 mr-2" />
              Download PDF
            </Button>
            <button
              onClick={reset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Convert another file
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
      }
