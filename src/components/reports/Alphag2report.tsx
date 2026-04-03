import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [pdfGenerating, setPdfGenerating] = useState(false);

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

  // ---------- Helper: load logo as base64 ----------
  const loadLogoAsBase64 = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; // in case of CORS issues (local file usually fine)
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = '/favicon.ico'; // path from public folder
    });
  };

  // ---------- ENHANCED PDF GENERATION WITH LOGO ----------
  const generatePDF = async () => {
    setPdfGenerating(true);
    try {
      // Load the logo
      const logoBase64 = await loadLogoAsBase64();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;

      // Helper to add a new page and reset Y
      const addNewPage = () => {
        doc.addPage();
        y = margin;
        // Add logo and header on each new page
        addHeaderToCurrentPage();
      };

      // Helper to add logo + report title on current page
      const addHeaderToCurrentPage = () => {
        if (logoBase64) {
          // Logo dimensions (scaled to ~20px height)
          const logoHeight = 15;
          const logoWidth = 15; // assuming square
          doc.addImage(logoBase64, 'PNG', margin, margin, logoWidth, logoHeight);
          // Title next to logo
          doc.setFontSize(16);
          doc.setTextColor(0, 0, 0);
          doc.text('Alpha G2 Security Report', margin + logoWidth + 5, margin + logoHeight - 2);
        } else {
          // Fallback if no logo
          doc.setFontSize(16);
          doc.text('Alpha G2 Security Report', margin, margin);
        }
        // Report ID and date line
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Report ID: ${report.test_run_id.slice(0, 8)}`, margin, margin + 22);
        doc.text(`Generated: ${formatDate(report.timestamp)}`, pageWidth - margin - 50, margin + 22, { align: 'right' });
        y = margin + 30; // move below header
      };

      // Add header on first page
      addHeaderToCurrentPage();

      // ---- Executive Summary as boxes ----
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Executive Summary', margin, y);
      y += 8;

      const boxWidth = (pageWidth - 2 * margin - 10) / 4;
      const boxHeight = 40;
      const summaries = [
        { label: 'Total Vulnerabilities', value: report.summary.total_vulnerabilities },
        { label: 'Risk Level', value: report.summary.risk_level.toUpperCase() },
        { label: 'Tests Blocked', value: report.summary.blocked_tests },
        { 
          label: 'Average CVSS', 
          value: report.vulnerabilities.length > 0 
            ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
            : '0.0'
        }
      ];

      summaries.forEach((item, idx) => {
        const x = margin + idx * (boxWidth + 3);
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, boxWidth, boxHeight, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, boxWidth, boxHeight, 'S');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(item.label, x + 2, y + 7);
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(String(item.value), x + 2, y + 25);
      });
      y += boxHeight + 10;

      // ---- Target Information ----
      doc.setFontSize(14);
      doc.text('Target Information', margin, y);
      y += 8;

      const colWidth = (pageWidth - 2 * margin) / 2;
      const rowHeight = 10;
      const targetRows = [
        { label: 'Website URL', value: report.base_url },
        { label: 'Scan Type', value: 'Alpha G2 Professional' },
        { label: 'Scanned At', value: formatDate(report.timestamp) },
        { label: 'Scan ID', value: report.test_run_id.slice(0, 8) }
      ];

      targetRows.forEach((row, idx) => {
        const col = idx % 2;
        const rowIdx = Math.floor(idx / 2);
        const x = margin + col * colWidth;
        const yPos = y + rowIdx * rowHeight;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(row.label + ':', x, yPos);
        doc.setTextColor(0);
        doc.text(row.value, x + (col === 0 ? 50 : 40), yPos);
      });
      y += rowHeight * 2 + 10;

      // ---- Test Summary Table ----
      if (Object.keys(report.test_summary).length > 0) {
        doc.setFontSize(14);
        doc.text('Test Summary', margin, y);
        y += 8;

        const tableData = Object.entries(report.test_summary).map(([testName, info]) => [
          testName,
          TEST_DESCRIPTIONS[testName] || 'No description',
          info.status,
          info.details || '-'
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Test', 'Description', 'Status', 'Details']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [60, 60, 60] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 70 },
            2: { cellWidth: 30 },
            3: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin },
          didDrawPage: (data) => {
            y = data.cursor?.y || y + 10;
          }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ---- Vulnerabilities ----
      if (report.vulnerabilities.length > 0) {
        doc.setFontSize(14);
        doc.text('Vulnerabilities Found', margin, y);
        y += 8;

        for (let idx = 0; idx < report.vulnerabilities.length; idx++) {
          const vuln = report.vulnerabilities[idx];
          if (y > pageHeight - margin - 40) addNewPage();

          // Card background
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(margin, y, pageWidth - 2 * margin, 25, 'S');

          doc.setFontSize(11);
          doc.setTextColor(0);
          doc.text(vuln.vulnerability, margin + 2, y + 7);
          doc.setFontSize(9);
          doc.setTextColor(100);
          doc.text(`CVSS: ${vuln.cvss_score}`, pageWidth - margin - 25, y + 7);
          doc.text(`Endpoint: ${vuln.endpoint}`, margin + 2, y + 15);

          y += 30;

          // OWASP
          doc.setFontSize(10);
          doc.setTextColor(60);
          doc.text(`OWASP: ${vuln.owasp}`, margin + 2, y);
          y += 6;

          if (vuln.parameter) {
            doc.text(`Parameter: ${vuln.parameter}`, margin + 2, y);
            y += 6;
          }
          if (vuln.payload) {
            doc.text('Payload:', margin + 2, y);
            y += 5;
            const payloadLines = doc.splitTextToSize(vuln.payload, pageWidth - 2 * margin - 10);
            doc.setFontSize(8);
            doc.setTextColor(80);
            payloadLines.forEach((line: string) => {
              if (y > pageHeight - margin - 10) addNewPage();
              doc.text(line, margin + 4, y);
              y += 4;
            });
            y += 2;
            doc.setFontSize(10);
            doc.setTextColor(0);
          }

          // Remediation
          doc.setFontSize(10);
          doc.setTextColor(0);
          doc.text('How to Fix:', margin + 2, y);
          y += 5;
          doc.setFontSize(9);
          doc.setTextColor(80);
          const remediation = getRemediation(vuln);
          const remLines = doc.splitTextToSize(remediation, pageWidth - 2 * margin - 10);
          remLines.forEach((line: string) => {
            if (y > pageHeight - margin - 10) addNewPage();
            doc.text(line, margin + 4, y);
            y += 4;
          });
          y += 4;

          // Evidence
          if (vuln.raw_request || vuln.raw_response) {
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text('Evidence:', margin + 2, y);
            y += 5;
            if (vuln.raw_request) {
              doc.setFontSize(8);
              doc.setTextColor(80);
              doc.text('Request:', margin + 4, y);
              y += 4;
              const reqStr = JSON.stringify(vuln.raw_request, null, 2);
              const reqLines = doc.splitTextToSize(reqStr, pageWidth - 2 * margin - 20);
              reqLines.forEach((line: string) => {
                if (y > pageHeight - margin - 10) addNewPage();
                doc.text(line, margin + 6, y);
                y += 4;
              });
            }
            if (vuln.raw_response) {
              if (y > pageHeight - margin - 10) addNewPage();
              doc.setFontSize(8);
              doc.setTextColor(80);
              doc.text('Response:', margin + 4, y);
              y += 4;
              const resStr = JSON.stringify(vuln.raw_response, null, 2);
              const resLines = doc.splitTextToSize(resStr, pageWidth - 2 * margin - 20);
              resLines.forEach((line: string) => {
                if (y > pageHeight - margin - 10) addNewPage();
                doc.text(line, margin + 6, y);
                y += 4;
              });
            }
            y += 4;
          }

          // Separator
          doc.setDrawColor(200, 200, 200);
          doc.line(margin, y, pageWidth - margin, y);
          y += 10;
        }
      } else {
        doc.setFontSize(12);
        doc.text('No vulnerabilities found.', margin, y);
        y += 10;
      }

      // ---- Footer on all pages ----
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Report generated by GROWHAZ Alpha G2 Professional Scanner on ${formatDate(report.timestamp)}`,
          margin,
          pageHeight - 10
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
      }

      doc.save(`security-report-${getSanitizedUrl(report.base_url)}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    generatePDF();
  };

  // ---- Return JSX (identical to your original, but with PDF button disabled while generating) ----
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
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={pdfGenerating} className="gap-1">
              <Download className="w-4 h-4" /> {pdfGenerating ? 'Generating...' : 'Download PDF'}
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
        
