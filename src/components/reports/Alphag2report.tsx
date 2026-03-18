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

// Test descriptions (unchanged)
const TEST_DESCRIPTIONS: Record<string, string> = { /* ... */ };

// Remediation tips (unchanged)
const REMEDIATION_TIPS: Record<string, string> = { /* ... */ };

interface Vulnerability { /* ... */ }
interface TestSummary { /* ... */ }
interface SecurityReport { /* ... */ }
interface SecurityReportProps { /* ... */ }

const SecurityReportComponent: React.FC<SecurityReportProps> = ({ report, onExport, onShare }) => {
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);

  // Helper functions (unchanged)
  const getRiskColor = (level: string) => { /* ... */ };
  const getStatusBadge = (status: string) => { /* ... */ };
  const getCVSSColor = (score: number) => { /* ... */ };
  const formatDate = (dateString: string) => { /* ... */ };
  const copyToClipboard = (text: string) => { /* ... */ };
  const getRemediation = (vuln: Vulnerability): string => { /* ... */ };
  const getSanitizedUrl = (url: string) => url.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  const handleDownloadPDF = () => {
    // Temporarily set document title for PDF filename
    const originalTitle = document.title;
    document.title = `security-report-${getSanitizedUrl(report.base_url)}`;
    
    // Use print dialog – the print styles will handle the layout
    window.print();
    
    setTimeout(() => { document.title = originalTitle; }, 1000);
  };

  return (
    <>
      <style type="text/css" media="print">{`
        /* Reset for print */
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }

        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          color: black;
          line-height: 1.4;
          text-rendering: optimizeLegibility;
        }

        /* Hide interactive elements */
        .no-print,
        button,
        .cursor-pointer,
        [onclick] {
          display: none !important;
        }

        /* Ensure all content is visible */
        .print-only { display: block !important; }
        .vuln-details { display: block !important; }
        .hidden.print\\:block { display: block !important; }

        /* Remove shadows, borders, backgrounds for cleaner print */
        .border, .shadow-md, .shadow-xl, .bg-card {
          border: none !important;
          box-shadow: none !important;
          background: white !important;
        }

        /* Keep subtle borders for tables */
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-size: 11pt;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: 600;
        }

        /* Prevent page breaks inside cards and table rows */
        .vuln-card,
        tr,
        pre,
        .break-inside-avoid {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Ensure long pre blocks don't overflow */
        pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          background: #f6f8fa !important;
          border: 1px solid #ddd;
          padding: 8px;
          font-size: 9pt;
        }

        /* Headers */
        h2, h3, h4 {
          break-after: avoid;
          margin-top: 1.2em;
          margin-bottom: 0.6em;
        }

        /* Remove expand/collapse icons */
        .lucide-chevron-down,
        .lucide-chevron-up {
          display: none;
        }

        /* Print header with logo */
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #ccc;
          padding-bottom: 0.5cm;
          margin-bottom: 1cm;
        }
        .print-header img {
          max-height: 1.5cm;
          width: auto;
        }

        /* Override any background colors for badges */
        .badge {
          background: transparent !important;
          border: 1px solid currentColor;
          color: black !important;
        }
      `}</style>

      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-6 print:bg-white print:text-black print:border-0 print:shadow-none print:p-0">
        {/* Web header – hidden in print */}
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

        {/* Print header with logo – only visible in print */}
        <div className="hidden print:block print-header">
          <div className="flex items-center gap-4">
            <img src="/favicon.ico" alt="GROWHAZ Logo" className="h-12 w-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div>
              <h1 className="text-2xl font-bold">Alpha G2 Security Report</h1>
              <p className="text-sm text-gray-600">GROWHAZ Professional Scanner</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>Report ID: {report.test_run_id.slice(0, 8)}</p>
            <p>Generated: {formatDate(report.timestamp)}</p>
          </div>
        </div>

        {/* Executive Summary – unchanged */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Executive Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ... summary cards (unchanged) ... */}
          </div>
        </div>

        {/* Target Info – unchanged */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* ... target info (unchanged) ... */}
        </div>

        {/* Test Summary Table – with print overflow fix */}
        {Object.keys(report.test_summary).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Test Summary</h3>
            <div className="overflow-x-auto print:overflow-visible">
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
                      <td className="py-2 px-3 text-xs text-muted-foreground print:text-gray-700">
                        {TEST_DESCRIPTIONS[testName] || "No description available."}
                      </td>
                      <td className="py-2 px-3">{getStatusBadge(info.status)}</td>
                      <td className="py-2 px-3 text-muted-foreground print:text-gray-700">{info.details || "-"}</td>
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
                    {/* Web interactive header – hidden in print */}
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

                    {/* Static print header – visible only in print */}
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
                          <p className="text-muted-foreground print:text-gray-600">OWASP Category</p>
                          <p className="font-medium">{vuln.owasp}</p>
                        </div>
                        {vuln.parameter && (
                          <div>
                            <p className="text-muted-foreground print:text-gray-600">Parameter</p>
                            <p className="font-medium break-all">{vuln.parameter}</p>
                          </div>
                        )}
                        {vuln.payload && (
                          <div className="col-span-1 sm:col-span-2">
                            <p className="text-muted-foreground print:text-gray-600">Payload</p>
                            <code className="mt-1 block bg-muted p-2 rounded text-xs font-mono break-all print:bg-gray-100 print:border print:border-gray-300">
                              {vuln.payload}
                            </code>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium mb-1 flex items-center gap-1">
                          <Info className="w-4 h-4 text-primary print:hidden" />
                          <span>How to Fix</span>
                        </h4>
                        <p className="text-sm text-muted-foreground print:text-gray-700">{getRemediation(vuln)}</p>
                      </div>

                      {(vuln.raw_request || vuln.raw_response) && (
                        <div>
                          <h4 className="font-medium mb-2">Evidence</h4>
                          <div className="space-y-3">
                            {vuln.raw_request && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1 print:text-gray-600">Request:</p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:text-gray-900 print:border print:border-gray-300">
                                  {JSON.stringify(vuln.raw_request, null, 2)}
                                </pre>
                              </div>
                            )}
                            {vuln.raw_response && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1 print:text-gray-600">Response:</p>
                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:text-gray-900 print:border print:border-gray-300">
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
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <p className="text-lg font-medium">No vulnerabilities found</p>
            <p className="text-sm">Your application passed all security tests.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default SecurityReportComponent;
