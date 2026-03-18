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

// ✅ NEW IMPORTS
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// (rest of your constants stay SAME...)

const SecurityReportComponent: React.FC<SecurityReportProps> = ({ report, onExport, onShare }) => {
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);

  useEffect(() => {
    console.log("Vulnerabilities array length:", report.vulnerabilities.length);
  }, [report]);

  const getSanitizedUrl = (url: string) => url.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  // ✅ FIXED PDF DOWNLOAD FUNCTION
  const handleDownloadPDF = async () => {
    try {
      const element = document.querySelector(".bg-card") as HTMLElement;

      if (!element) {
        console.error("Report element not found");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = 210;
      const pageHeight = 297;

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Extra pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`security-report-${getSanitizedUrl(report.base_url)}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
    }
  };

  return (
    <>
      {/* ✅ NO CHANGE BELOW THIS LINE */}
      
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Alpha G2 Security Report
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="w-4 h-4 mr-1" />
                Export JSON
              </Button>
            )}

            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* KEEP YOUR FULL UI BELOW EXACTLY SAME */}
        
      </div>
    </>
  );
};

export default SecurityReportComponent;
