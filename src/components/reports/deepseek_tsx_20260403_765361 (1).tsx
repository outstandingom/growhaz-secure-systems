import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Shield,
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle2,
  Download,
  Clock,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// Remediation tips (same as before)
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

interface ReportViewerProps {
  report: any; // The full security report object from Supabase
  onClose?: () => void; // Optional close handler (if used in modal)
  showDownload?: boolean; // Whether to show download button (default true)
}

export function ReportViewer({ report, onClose, showDownload = true }: ReportViewerProps) {
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  if (!report) return null;

  const {
    website_url,
    scan_type,
    risk_level,
    vulnerabilities_found,
    scanned_at,
    report_data
  } = report;

  // Parse report_data if it's a string (should be JSON)
  let parsedData: any = {};
  if (report_data) {
    try {
      parsedData = typeof report_data === 'string' ? JSON.parse(report_data) : report_data;
    } catch (e) {
      console.error("Failed to parse report_data", e);
    }
  }

  const vulnerabilities = parsedData?.vulnerabilities || [];
  const testSummary = parsedData?.test_summary || {};
  const summary = parsedData?.summary || {};

  // Helper to get risk color
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "low": return "text-emerald-400";
      case "medium": return "text-amber-400";
      case "high": return "text-red-400";
      case "critical": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const riskBadge = (level: string) => {
    const color = getRiskColor(level);
    return <span className={`font-semibold ${color}`}>{level?.toUpperCase() || "UNKNOWN"}</span>;
  };

  // Helper: format date for PDF
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSanitizedUrl = (url: string) => url.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  // Helper: load logo as base64
  const loadLogoAsBase64 = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
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

  // Helper: get remediation for a vulnerability
  const getRemediation = (vuln: any): string => {
    if (vuln.remediation) return vuln.remediation;
    const type = vuln.vulnerability || "";
    for (const [key, tip] of Object.entries(REMEDIATION_TIPS)) {
      if (type.includes(key) || key.includes(type)) return tip;
    }
    return "Apply security best practices. See OWASP guidelines.";
  };

  // PDF generation (async, includes logo)
  const generatePDF = async () => {
    setPdfGenerating(true);
    try {
      const logoBase64 = await loadLogoAsBase64();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;

      // Helper: add header (logo + title + metadata) to current page
      const addHeaderToCurrentPage = () => {
        if (logoBase64) {
          const logoHeight = 15;
          const logoWidth = 15;
          doc.addImage(logoBase64, 'PNG', margin, margin, logoWidth, logoHeight);
          doc.setFontSize(16);
          doc.setTextColor(0, 0, 0);
          doc.text('Security Report', margin + logoWidth + 5, margin + logoHeight - 2);
        } else {
          doc.setFontSize(16);
          doc.text('Security Report', margin, margin);
        }
        doc.setFontSize(9);
        doc.setTextColor(100);
        const scanId = report.id ? report.id.slice(0, 8) : "N/A";
        doc.text(`Scan ID: ${scanId}`, margin, margin + 22);
        const dateStr = scanned_at ? formatDate(scanned_at) : formatDate(new Date().toISOString());
        doc.text(`Generated: ${dateStr}`, pageWidth - margin - 50, margin + 22, { align: 'right' });
        y = margin + 30;
      };

      // Helper: add new page and reset y
      const addNewPage = () => {
        doc.addPage();
        y = margin;
        addHeaderToCurrentPage();
      };

      // Initial header
      addHeaderToCurrentPage();

      // ---- Executive Summary boxes ----
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Executive Summary', margin, y);
      y += 8;

      const boxWidth = (pageWidth - 2 * margin - 10) / 4;
      const boxHeight = 40;
      const totalVulns = vulnerabilities_found ?? vulnerabilities.length ?? 0;
      const avgCVSS = vulnerabilities.length > 0
        ? (vulnerabilities.reduce((acc: number, v: any) => acc + (v.cvss_score || 0), 0) / vulnerabilities.length).toFixed(1)
        : '0.0';
      const summaries = [
        { label: 'Total Vulnerabilities', value: totalVulns },
        { label: 'Risk Level', value: (risk_level || 'unknown').toUpperCase() },
        { label: 'Tests Blocked', value: summary.blocked_tests || 0 },
        { label: 'Average CVSS', value: avgCVSS }
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
        { label: 'Website URL', value: website_url || 'N/A' },
        { label: 'Scan Type', value: scan_type || 'Standard' },
        { label: 'Scanned At', value: scanned_at ? formatDate(scanned_at) : 'N/A' },
        { label: 'Risk Level', value: (risk_level || 'unknown').toUpperCase() }
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
      if (Object.keys(testSummary).length > 0) {
        doc.setFontSize(14);
        doc.text('Test Summary', margin, y);
        y += 8;

        const tableData = Object.entries(testSummary).map(([testName, info]: [string, any]) => [
          testName,
          info.status,
          info.details || '-'
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Test', 'Status', 'Details']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [60, 60, 60] },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin },
          didDrawPage: (data) => {
            y = data.cursor?.y || y + 10;
          }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ---- Vulnerabilities ----
      if (vulnerabilities.length > 0) {
        doc.setFontSize(14);
        doc.text('Vulnerabilities Found', margin, y);
        y += 8;

        for (let idx = 0; idx < vulnerabilities.length; idx++) {
          const vuln = vulnerabilities[idx];
          if (y > pageHeight - margin - 40) addNewPage();

          // Card background
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(margin, y, pageWidth - 2 * margin, 25, 'S');

          doc.setFontSize(11);
          doc.setTextColor(0);
          doc.text(vuln.vulnerability || 'Unknown Vulnerability', margin + 2, y + 7);
          doc.setFontSize(9);
          doc.setTextColor(100);
          if (vuln.cvss_score) doc.text(`CVSS: ${vuln.cvss_score}`, pageWidth - margin - 25, y + 7);
          if (vuln.endpoint) doc.text(`Endpoint: ${vuln.endpoint}`, margin + 2, y + 15);

          y += 30;

          // OWASP / Severity
          if (vuln.owasp) {
            doc.setFontSize(10);
            doc.setTextColor(60);
            doc.text(`OWASP: ${vuln.owasp}`, margin + 2, y);
            y += 6;
          }
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

          // Evidence (raw request/response if present)
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
        const footerDate = scanned_at ? formatDate(scanned_at) : formatDate(new Date().toISOString());
        doc.text(
          `Report generated by GROWHAZ Security Scanner on ${footerDate}`,
          margin,
          pageHeight - 10
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
      }

      // Save PDF
      const fileName = `security-report-${getSanitizedUrl(website_url || 'scan')}.pdf`;
      doc.save(fileName);
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

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6 print:bg-white print:text-black print:border-0 print:shadow-none">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Security Report
        </h2>
        <div className="flex items-center gap-2">
          {showDownload && (
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={pdfGenerating} className="gap-1">
              <Download className="w-4 h-4" />
              {pdfGenerating ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Print header with logo */}
      <div className="hidden print:block mb-8">
        <div className="flex items-center justify-between border-b border-gray-300 pb-4">
          <div className="flex items-center space-x-4">
            <img src="/favicon.ico" alt="Company Logo" className="w-12 h-12" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Security Report</h1>
              <p className="text-sm text-gray-600">GROWHAZ Security Scanner</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Scan ID: {report.id ? report.id.slice(0, 8) : 'N/A'}</p>
            <p>Generated: {scanned_at ? format(new Date(scanned_at), "PPp") : format(new Date(), "PPp")}</p>
          </div>
        </div>
      </div>

      {/* Basic info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Website URL</p>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <a
              href={website_url?.startsWith('http') ? website_url : `https://${website_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            >
              {website_url}
              <ExternalLink className="w-3 h-3 inline ml-1" />
            </a>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Scan Type</p>
          <p className="font-medium capitalize">{scan_type || 'Standard'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Scanned At</p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{scanned_at ? format(new Date(scanned_at), "PPp") : "N/A"}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Risk Level</p>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${getRiskColor(risk_level)}`} />
            {riskBadge(risk_level)}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Vulnerabilities Found</p>
          <p className="font-medium">{vulnerabilities_found ?? vulnerabilities.length ?? 0}</p>
        </div>
      </div>

      {/* Test Summary Table */}
      {Object.keys(testSummary).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Test Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Test</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(testSummary).map(([testName, info]: [string, any]) => (
                  <tr key={testName} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium">{testName}</td>
                    <td className="py-2 px-3">
                      {info.status === "VULNERABLE" && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="w-3 h-3" /> Vulnerable
                        </Badge>
                      )}
                      {info.status === "SECURE" && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Secure
                        </Badge>
                      )}
                      {info.status === "BLOCKED" && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" /> Blocked
                        </Badge>
                      )}
                      {info.status === "ERROR" && (
                        <Badge variant="outline" className="text-destructive border-destructive/30 gap-1">
                          <AlertTriangle className="w-3 h-3" /> Error
                        </Badge>
                      )}
                      {!["VULNERABLE", "SECURE", "BLOCKED", "ERROR"].includes(info.status) && (
                        <Badge variant="outline">{info.status || "Unknown"}</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{info.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vulnerabilities List */}
      {vulnerabilities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Vulnerabilities Found</h3>
          <div className="space-y-2">
            {vulnerabilities.map((vuln: any, idx: number) => {
              const isExpanded = expandedVuln === `${idx}`;
              return (
                <div key={idx} className="border border-border rounded-lg p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedVuln(isExpanded ? null : `${idx}`)}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="font-medium">{vuln.vulnerability || "Unknown"}</span>
                      {vuln.severity && (
                        <Badge
                          variant={
                            vuln.severity === "high"
                              ? "destructive"
                              : vuln.severity === "medium"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {vuln.severity}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pl-6 space-y-2 text-sm">
                      {Object.entries(vuln).map(([key, val]) => {
                        if (key === "vulnerability" || key === "severity") return null;
                        return (
                          <div key={key} className="grid grid-cols-3 gap-2">
                            <span className="text-muted-foreground capitalize">{key}:</span>
                            <span className="col-span-2 font-mono text-xs break-all">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mr-2 text-emerald-400" />
          <span>No vulnerabilities found</span>
        </div>
      )}

      {/* Print-specific footer */}
      <div className="hidden print:block text-xs text-center text-gray-500 mt-8">
        <p>Report generated by GROWHAZ Security Scanner on {format(new Date(), "PPp")}</p>
      </div>
    </div>
  );
}