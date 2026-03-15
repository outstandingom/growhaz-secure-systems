import React, { useState, useRef } from 'react';
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
  Printer
} from 'lucide-react';

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
  const componentRef = useRef<HTMLDivElement>(null);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VULNERABLE': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'SECURE': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'BLOCKED': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'ERROR': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCVSSColor = (score: number) => {
    if (score >= 7.0) return 'text-red-600 bg-red-100';
    if (score >= 4.0) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
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
    // Optional: add a toast notification here
  };

  // Sanitize URL for filename
  const getSanitizedUrl = (url: string) => {
    return url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  };

  const handleDownloadPDF = () => {
    // Save original title
    const originalTitle = document.title;
    // Set title to desired filename (will be used by some browsers as default PDF name)
    document.title = `security-report-${getSanitizedUrl(report.base_url)}`;
    // Trigger print dialog
    window.print();
    // Restore title after a short delay (print dialog is modal, but just in case)
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <>
      {/* Print Styles */}
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

      <div ref={componentRef} className="max-w-6xl mx-auto p-6 space-y-6 bg-white">
        {/* Header with Company Logo (web view) */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white shadow-xl no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold">Security Scan Report</h1>
                <p className="text-blue-100 mt-1">GROWHAZ Alpha G2 Professional Scanner</p>
              </div>
            </div>
            <div className="flex space-x-3">
              {onExport && (
                <button
                  onClick={onExport}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center space-x-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Export JSON</span>
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center space-x-2 transition"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg flex items-center space-x-2 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Print Header with Company Logo */}
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
                <h1 className="text-2xl font-bold text-gray-800">Security Scan Report</h1>
                <p className="text-sm text-gray-600">GROWHAZ Alpha G2 Professional Scanner</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Report ID: {report.test_run_id.slice(0, 8)}</p>
              <p>Generated: {formatDate(report.timestamp)}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 print:border print:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vulnerabilities</p>
                <p className="text-3xl font-bold mt-1">{report.summary.total_vulnerabilities}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center print:bg-gray-100">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 print:border print:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Risk Level</p>
                <p className={`text-3xl font-bold mt-1 capitalize ${
                  report.summary.risk_level === 'high' ? 'text-red-600' :
                  report.summary.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {report.summary.risk_level}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                report.summary.risk_level === 'high' ? 'bg-red-100' :
                report.summary.risk_level === 'medium' ? 'bg-yellow-100' : 'bg-green-100'
              } print:bg-gray-100`}>
                <Shield className={`w-6 h-6 ${
                  report.summary.risk_level === 'high' ? 'text-red-600' :
                  report.summary.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 print:border print:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tests Blocked</p>
                <p className="text-3xl font-bold mt-1">{report.summary.blocked_tests}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center print:bg-gray-100">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 print:border print:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">CVSS Avg Score</p>
                <p className="text-3xl font-bold mt-1">
                  {report.vulnerabilities.length > 0
                    ? (report.vulnerabilities.reduce((acc, v) => acc + v.cvss_score, 0) / report.vulnerabilities.length).toFixed(1)
                    : '0.0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center print:bg-gray-100">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Target Info Card */}
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 print:border print:shadow-none print-break-inside">
          <div className="flex items-center space-x-2 mb-4">
            <Globe className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Target Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Target URL</p>
              <p className="font-medium mt-1 break-all">{report.base_url}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Scan ID</p>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm print:bg-gray-100">{report.test_run_id.slice(0, 8)}...</code>
                <button onClick={() => copyToClipboard(report.test_run_id)} className="text-gray-400 hover:text-gray-600 no-print">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Scan Time</p>
              <div className="flex items-center space-x-2 mt-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{formatDate(report.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test Summary Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden print:border print:shadow-none print-break-inside">
          <button
            onClick={() => setExpandedSection(expandedSection === 'summary' ? null : 'summary')}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition no-print"
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Test Summary</h2>
            </div>
            {expandedSection === 'summary' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          <div className={`px-6 pb-6 ${expandedSection === 'summary' ? 'block' : 'hidden print:block'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(report.test_summary).map(([testName, testData]) => (
                <div key={testName} className="border rounded-lg p-4 hover:shadow-md transition print:border print:shadow-none">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getStatusIcon(testData.status)}
                      <div>
                        <h3 className="font-medium">{testName}</h3>
                        <p className="text-sm text-gray-500 mt-1">{testData.details}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      testData.status === 'VULNERABLE' ? 'bg-red-100 text-red-700' :
                      testData.status === 'SECURE' ? 'bg-green-100 text-green-700' :
                      testData.status === 'BLOCKED' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    } print:bg-gray-100 print:text-gray-700`}>
                      {testData.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vulnerabilities Section */}
        {report.vulnerabilities.length > 0 && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden print:border print:shadow-none">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold">Vulnerabilities Found</h2>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium print:bg-gray-100 print:text-gray-700">
                  {report.vulnerabilities.length} Total
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {report.vulnerabilities.map((vuln, index) => (
                <div key={index} className="hover:bg-gray-50 transition print-break-inside">
                  <button
                    onClick={() => setExpandedVuln(expandedVuln === index ? null : index)}
                    className="w-full px-6 py-4 flex items-center justify-between no-print"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <div className="text-left">
                          <h3 className="font-medium">{vuln.vulnerability}</h3>
                          <p className="text-sm text-gray-500 mt-1">{vuln.endpoint}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCVSSColor(vuln.cvss_score)} print:bg-gray-100 print:text-gray-700`}>
                        CVSS {vuln.cvss_score}
                      </span>
                      {expandedVuln === index ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  <div className={`px-6 pb-6 ${expandedVuln === index ? 'block' : 'hidden print:block'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">OWASP Category</p>
                        <p className="font-medium mt-1">{vuln.owasp}</p>
                      </div>
                      {vuln.parameter && (
                        <div>
                          <p className="text-sm text-gray-500">Parameter</p>
                          <p className="font-medium mt-1">{vuln.parameter}</p>
                        </div>
                      )}
                      {vuln.payload && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Payload</p>
                          <code className="mt-1 block bg-gray-100 p-3 rounded-lg text-sm font-mono break-all print:bg-gray-100">
                            {vuln.payload}
                          </code>
                        </div>
                      )}
                    </div>

                    {(vuln.raw_request || vuln.raw_response) && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Evidence</h4>
                        <div className="space-y-3">
                          {vuln.raw_request && (
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Request:</p>
                              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto print:bg-gray-100 print:text-gray-900">
                                {JSON.stringify(vuln.raw_request, null, 2)}
                              </pre>
                            </div>
                          )}
                          {vuln.raw_response && (
                            <div>
                              <p className="text-sm text-gray-500 mb-1">Response:</p>
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
              ))}
            </div>
          </div>
        )}

        {/* No Vulnerabilities Found */}
        {report.vulnerabilities.length === 0 && (
          <div className="bg-white rounded-xl p-12 shadow-md border border-gray-100 text-center print:border print:shadow-none">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Vulnerabilities Found</h2>
            <p className="text-gray-500">Your application passed all security checks. Great job!</p>
          </div>
        )}

        {/* Footer (web) */}
        <div className="text-center text-sm text-gray-400 pt-4 no-print">
          <p>Generated by GROWHAZ Alpha G2 Professional Security Scanner • {formatDate(report.timestamp)}</p>
        </div>

        {/* Footer (print) */}
        <div className="hidden print:block text-xs text-center text-gray-500 mt-8 pt-4 border-t border-gray-300">
          <p>Report generated by GROWHAZ Alpha G2 Professional Security Scanner on {formatDate(report.timestamp)}</p>
          <p className="mt-1">This is a computer-generated report. For any queries, contact support@growhaz.com</p>
        </div>
      </div>
    </>
  );
};

export default SecurityReportComponent;
