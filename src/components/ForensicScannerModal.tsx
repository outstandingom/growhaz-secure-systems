// src/components/ForensicScannerModal.tsx

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileUp,
  Shield,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  LogIn,
  Clock,
  Users,
  FileText,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Types
interface ForensicReport {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  mode: string;
  status: "pending" | "processing" | "complete" | "failed";
  error_message: string | null;
  risk_score: number | null;
  risk_level: "none" | "low" | "medium" | "high" | null;
  explanation_summary: string | null;
  flags: string[] | null;
  full_report: any | null;
  created_at: string;
  completed_at: string | null;
}

interface ForensicScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "idle" | "uploading" | "processing" | "done" | "error";

export function ForensicScannerModal({ isOpen, onClose }: ForensicScannerModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"light" | "full">("full");
  const [step, setStep] = useState<Step>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const navigate = useNavigate();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth on mount
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Poll report status
  useEffect(() => {
    if (step === "processing" && reportId) {
      let attempts = 0;
      const MAX_ATTEMPTS = 120; // 10 minutes at 5s intervals

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const { data, error } = await supabase
            .from("forensic_reports")
            .select("*")
            .eq("id", reportId)
            .single();

          if (error) {
            console.error("Poll error:", error);
            return;
          }

          const r = data as ForensicReport;
          setReport(r);

          if (r.status === "complete") {
            setStep("done");
            stopPolling();
          } else if (r.status === "failed") {
            setStep("error");
            setErrorMsg(r.error_message || "Scan failed.");
            stopPolling();
          } else if (attempts >= MAX_ATTEMPTS) {
            setStep("error");
            setErrorMsg("Scan is taking too long. Check the report later.");
            stopPolling();
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 5000);

      return () => stopPolling();
    }
  }, [step, reportId]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (!file) return;
    if (!isLoggedIn) {
      navigate("/auth");
      onClose();
      return;
    }

    setStep("uploading");
    setErrorMsg("");

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", (await supabase.auth.getUser()).data.user?.id || "");
      formData.append("mode", mode);

      // Call the submit-scan edge function
      const { data, error } = await supabase.functions.invoke("submit-scan", {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.report_id) {
        throw new Error("No report_id returned");
      }

      setReportId(data.report_id);
      setStep("processing");
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message || "Failed to submit scan. Please try again.");
    }
  };

  const handleDownloadReport = () => {
    if (!report?.full_report) return;
    const blob = new Blob([JSON.stringify(report.full_report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forensic-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setMode("full");
    setStep("idle");
    setReportId(null);
    setReport(null);
    setErrorMsg("");
    setShowFullReport(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (step === "processing") {
      if (!confirm("Scan is in progress. Are you sure you want to close? The scan will continue in the background.")) {
        return;
      }
    }
    handleReset();
    onClose();
  };

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case "high": return "text-red-500";
      case "medium": return "text-amber-500";
      case "low": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  const getRiskBg = (level: string | null) => {
    switch (level) {
      case "high": return "bg-red-500/10 border-red-500/30";
      case "medium": return "bg-amber-500/10 border-amber-500/30";
      case "low": return "bg-blue-500/10 border-blue-500/30";
      default: return "bg-muted/30 border-border/40";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(1) + " GB";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Forensic File Scanner
          </DialogTitle>
          <DialogDescription>
            Upload an image or PDF for deep forensic analysis
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-700 ease-out",
              step === "idle" && "w-0",
              step === "uploading" && "w-1/4",
              step === "processing" && "w-2/3",
              step === "done" && "w-full bg-primary",
              step === "error" && "w-full bg-destructive",
            )}
          />
        </div>

        <div className="mt-4">
          {step === "idle" && (
            <div className="space-y-6">
              {/* Auth Warning */}
              {isLoggedIn === false && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <LogIn className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Login Required</p>
                    <p className="text-xs text-muted-foreground">
                      You need to log in or register before scanning files
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => { navigate("/auth"); onClose(); }}
                  >
                    Login
                  </Button>
                </div>
              )}

              {/* File Upload */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                  file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp,.pdf,image/jpeg,image/png,image/gif,image/bmp,image/tiff,image/webp,application/pdf"
                />
                <Label htmlFor="file-upload" className="cursor-pointer block">
                  <FileUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">
                    {file ? file.name : "Click or drag & drop to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {file ? formatFileSize(file.size) : "Supported: Images & PDF (max 100 MB)"}
                  </p>
                </Label>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <Label>Scan Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      mode === "light"
                        ? "border-primary bg-primary/5"
                        : "border-border/40 hover:border-primary/30"
                    )}
                    onClick={() => setMode("light")}
                  >
                    <Zap className="w-4 h-4 text-amber-500 mb-1" />
                    <p className="font-medium text-sm">Light</p>
                    <p className="text-xs text-muted-foreground">Fast triage</p>
                  </button>
                  <button
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      mode === "full"
                        ? "border-primary bg-primary/5"
                        : "border-border/40 hover:border-primary/30"
                    )}
                    onClick={() => setMode("full")}
                  >
                    <Shield className="w-4 h-4 text-primary mb-1" />
                    <p className="font-medium text-sm">Full</p>
                    <p className="text-xs text-muted-foreground">Deep analysis</p>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base gap-2"
                disabled={!file || !isLoggedIn}
                onClick={handleSubmit}
              >
                {!isLoggedIn ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Login to Scan
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Scan File
                    <span className="text-xs opacity-70 ml-1">(Free)</span>
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By scanning, you agree to our terms. Files are processed securely and deleted after 90 days.
              </p>
            </div>
          )}

          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Uploading...</p>
                <p className="text-sm text-muted-foreground">
                  Sending <span className="text-foreground font-medium">{file?.name}</span> for analysis
                </p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Scanning...</p>
                <p className="text-sm text-muted-foreground">
                  Running forensic analysis on <span className="text-foreground font-medium">{report?.file_name || file?.name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 2–5 minutes. You can close this window and check the report later.
                </p>
                <p className="text-xs text-muted-foreground">
                  Report ID: <span className="font-mono">{reportId}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-mono">{report?.status || "processing..."}</span>
                </p>
              </div>
            </div>
          )}

          {step === "done" && report && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Scan Complete</p>
                  <p className="text-sm text-muted-foreground">
                    {report.file_name} — {formatFileSize(report.file_size)}
                  </p>
                </div>
              </div>

              {/* Risk Summary */}
              <div className={cn(
                "p-4 rounded-xl border",
                getRiskBg(report.risk_level)
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Risk Assessment</p>
                    <p className={cn("text-2xl font-bold", getRiskColor(report.risk_level))}>
                      {report.risk_level?.toUpperCase() || "UNKNOWN"}
                    </p>
                    <p className="text-sm">
                      Score: {report.risk_score ?? "—"} / 100
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-xs text-muted-foreground">
                      {report.completed_at ? new Date(report.completed_at).toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>
                {report.explanation_summary && (
                  <div className="mt-2 p-2 bg-background/50 rounded-md text-sm">
                    {report.explanation_summary}
                  </div>
                )}
              </div>

              {/* Flags */}
              {report.flags && report.flags.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Flags ({report.flags.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {report.flags.map((flag, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm bg-muted/30 p-2 rounded-md">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Report Toggle */}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowFullReport(!showFullReport)}
                >
                  {showFullReport ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {showFullReport ? "Hide" : "Show"} Full Report (JSON)
                </Button>
                {showFullReport && report.full_report && (
                  <div className="mt-2 p-3 bg-muted/30 rounded-md overflow-auto max-h-60 text-xs font-mono">
                    <pre>{JSON.stringify(report.full_report, null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="hero"
                  className="flex-1 gap-2"
                  onClick={handleDownloadReport}
                >
                  <Download className="w-4 h-4" />
                  Download Report (JSON)
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  Scan Another File
                </Button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Scan Failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                {reportId && (
                  <p className="text-xs text-muted-foreground">
                    Report ID: <span className="font-mono">{reportId}</span>
                  </p>
                )}
              </div>
              <Button variant="ghost" onClick={handleReset}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
