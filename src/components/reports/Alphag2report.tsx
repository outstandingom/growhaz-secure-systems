
export default SecurityReportComponent;import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  XCircle,
  CheckCircle2,
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
import { format } from 'date-fns';

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

  // Helper to get risk colour (matches original)
  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const riskBadge = (level: string) => {
    const color = getRiskColor(level);
    return <span className={`font-semibold ${color}`}>{level?.toUpperCase() || 'UNKNOWN'}</span>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VULNERABLE': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'SECURE': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'BLOCKED': return <Shield className="w-4 h-4 text-amber-400" />;
      case 'ERROR': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCVSSColor = (score: number) => {
    if (score >= 7.0) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (score >= 4.0) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPp');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optionally add a toast notification
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6 print:bg-white print:text-black">
      {/* Header with actions (matches original) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Security Scan Report
        </h2>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
              <Download className="w-4 h-4" />
              Export
            </Button>
          )}
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare} className="gap-1">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Grid (styled like original cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Vulnerabilities</p>
              <p className="text-2xl font-bold mt-1">{report.summary.total_vulnerabilities}</p>
            </div>
            <div className="w-10 h-10 bg-red-400/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <div className="mt-1 flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${getRiskColor(report.summary.risk_level)}`} />
                {riskBadge(report.summary.risk_level)}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              report.summary.risk_level === 'high' ? 'bg-red-400/10' :
              report.summary.risk_level === 'medium' ? 'bg-amber-400/10' : 'bg-emerald-400/10'
            }`}>
              <Shield className={`w-5 h-5 ${
                report.summary.risk_level === 'high' ? 'text-red-400' :
                report.summary.risk_level === 'medium' ? 'text-amber-400' : 'text-emerald-400'
              }`} />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tests Blocked</p>
              <p className="text-2xl font-bold mt-1">{report.summary.blocked_tests}</p>
            </div>
            <div className="w-10 h-10 bg-amber-400/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">CVSS Avg Score</p>
              <p className="text-2xl font-bold mt-1">
                {report.vulnerabilities.length > 0
                  ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
                  : '0.0'}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Target Info Card (matches original info grid style) */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Target Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Target URL</p>
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
            <p className="text-sm text-muted-foreground">Scan ID</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded text-sm">{report.test_run_id.slice(0, 8)}...</code>
              <button onClick={() => copyToClipboard(report.test_run_id)} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Scan Time</p>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{formatDate(report.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Summary Section (collapsible like original, but with table) */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'summary' ? null : 'summary')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Test Summary</h3>
          </div>
          {expandedSection === 'summary' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedSection === 'summary' && (
          <div className="p-4 border-t border-border">
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
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(info.status)}
                          <Badge
                            variant={
                              info.status === 'VULNERABLE' ? 'destructive' :
                              info.status === 'SECURE' ? 'default' :
                              info.status === 'BLOCKED' ? 'secondary' :
                              'outline'
                            }
                            className={
                              info.status === 'SECURE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''
                            }
                          >
                            {info.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{info.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Vulnerabilities Section */}
      {report.vulnerabilities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Vulnerabilities Found
            <Badge variant="destructive" className="ml-2">{report.vulnerabilities.length}</Badge>
          </h3>
          <div className="space-y-2">
            {report.vulnerabilities.map((vuln, index) => {
              const isExpanded = expandedVuln === index;
              return (
                <div key={index} className="border border-border rounded-lg p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedVuln(isExpanded ? null : index)}
                  >
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="font-medium">{vuln.vulnerability}</span>
                      {vuln.cvss_score && (
                        <Badge className={`text-xs ${getCVSSColor(vuln.cvss_score)}`}>
                          CVSS {vuln.cvss_score}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-6 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground">Endpoint:</p>
                          <p className="font-mono text-xs break-all">{vuln.endpoint}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">OWASP:</p>
                          <p>{vuln.owasp}</p>
                        </div>
                        {vuln.parameter && (
                          <div>
                            <p className="text-muted-foreground">Parameter:</p>
                            <p>{vuln.parameter}</p>
                          </div>
                        )}
                      </div>

                      {vuln.payload && (
                        <div>
                          <p className="text-muted-foreground">Payload:</p>
                          <pre className="mt-1 bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto">
                            {vuln.payload}
                          </pre>
                        </div>
                      )}

                      {(vuln.raw_request || vuln.raw_response) && (
                        <div className="space-y-2">
                          <p className="text-muted-foreground font-medium">Evidence:</p>
                          {vuln.raw_request && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Request:</p>
                              <pre className="bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto">
                                {JSON.stringify(vuln.raw_request, null, 2)}
                              </pre>
                            </div>
                          )}
                          {vuln.raw_response && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Response:</p>
                              <pre className="bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto">
                                {JSON.stringify(vuln.raw_response, null, 2)}
                              </pre>
                            </div>
                          )}
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
          <CheckCircle2 className="w-8 h-8 mr-2 text-emerald-400" />
          <span>No vulnerabilities found</span>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-xs text-center text-muted-foreground mt-8">
        <p>Report generated by GROWHAZ Security Scanner on {format(new Date(), "PPp")}</p>
      </div>
    </div>
  );
};

export default SecurityReportComponent;
