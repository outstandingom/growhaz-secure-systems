import { useState } from "react";
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

interface ReportViewerProps {
  report: any; // The full security report object from Supabase
  onClose?: () => void; // Optional close handler (if used in modal)
  showDownload?: boolean; // Whether to show download button (default true)
}

export function ReportViewer({ report, onClose, showDownload = true }: ReportViewerProps) {
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);

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

  // Print handler
  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6 print:bg-white print:text-black">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Security Report
        </h2>
        <div className="flex items-center gap-2">
          {showDownload && (
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Basic info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Website URL</p>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <a
              href={website_url.startsWith('http') ? website_url : `https://${website_url}`}
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
          <p className="font-medium capitalize">{scan_type}</p>
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
          <p className="font-medium">{vulnerabilities_found}</p>
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
