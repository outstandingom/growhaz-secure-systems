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
  ExternalLink
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      {/* Print styles */}
      <style type="text/css" media="print">{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
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
      `}</style>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6 print:bg-white print:text-black">
        {/* Header with actions (web only) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Alpha G2 Security Report
          </h2>
          <div className="flex items-center gap-2">
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

        {/* Basic info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Website URL</p>
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
            <p className="text-sm text-muted-foreground">Scan Type</p>
            <p className="font-medium capitalize">Alpha G2 Professional</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Scanned At</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{formatDate(report.timestamp)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Risk Level</p>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${getRiskColor(report.summary.risk_level)}`} />
              <span className={`font-semibold ${getRiskColor(report.summary.risk_level)}`}>
                {report.summary.risk_level.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Vulnerabilities Found</p>
            <p className="font-medium">{report.summary.total_vulnerabilities}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tests Blocked</p>
            <p className="font-medium">{report.summary.blocked_tests}</p>
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
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.test_summary).map(([testName, info]) => (
                    <tr key={testName} className="border-b border-border/50">
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
            <div className="space-y-2">
              {report.vulnerabilities.map((vuln, idx) => {
                const isExpanded = expandedVuln === idx;
                return (
                  <div key={idx} className="border border-border rounded-lg p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedVuln(isExpanded ? null : idx)}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="font-medium">{vuln.vulnerability}</span>
                        <Badge className={`${getCVSSColor(vuln.cvss_score)} text-xs`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Endpoint</p>
                            <p className="font-medium break-all">{vuln.endpoint}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">OWASP</p>
                            <p className="font-medium">{vuln.owasp}</p>
                          </div>
                          {vuln.parameter && (
                            <div>
                              <p className="text-muted-foreground">Parameter</p>
                              <p className="font-medium">{vuln.parameter}</p>
                            </div>
                          )}
                          {vuln.payload && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Payload</p>
                              <code className="mt-1 block bg-muted p-2 rounded text-xs font-mono break-all">
                                {vuln.payload}
                              </code>
                            </div>
                          )}
                        </div>

                        {/* Evidence */}
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
            <CheckCircle className="w-8 h-8 mr-2 text-emerald-400" />
            <span>No vulnerabilities found</span>
          </div>
        )}

        {/* Print footer */}
        <div className="hidden print:block text-xs text-center text-gray-500 mt-8 pt-4 border-t border-gray-300">
          <p>Report generated by GROWHAZ Alpha G2 Professional Scanner on {formatDate(report.timestamp)}</p>
          <p className="mt-1">This is a computer-generated report. For queries, contact support@growhaz.com</p>
        </div>
      </div>
    </>
  );
};

export default SecurityReportComponent;
