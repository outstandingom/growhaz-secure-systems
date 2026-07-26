import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Hash,
  Eye,
  EyeOff,
  Download,
} from "lucide-react";

interface ForensicReport {
  id: string;
  file_name: string;
  file_size: number | null;
  status: "pending" | "processing" | "complete" | "failed" | "queued";
  error_message: string | null;
  risk_score: number | null;
  risk_level: "none" | "low" | "medium" | "high" | null;
  explanation_summary: string | null;
  flags: string[] | null;
  full_report: any | null;
}

type Step = "idle" | "uploading" | "queued" | "processing" | "done" | "error";

interface Props {
  file: File | null;
  userId: string | null;
  /** Optional: hashes computed by the parent verify pipeline (shown as the hash layer). */
  fileHash?: string;
  contentHash?: string;
  merkleRoot?: string;
  leafHashes?: { index: number; hash: string }[];
  fileHashMatch?: boolean;
  contentHashMatch?: boolean;
  merkleRootMatch?: boolean;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function findingIcon(text: string) {
  const t = text.toLowerCase();
  if (t.includes("copy-move") || t.includes("clone")) return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
  if (t.includes("resampling") || t.includes("stegan")) return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
  if (t.includes("ela") || t.includes("compression") || t.includes("noise")) return <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />;
}

export function ForensicLayer(props: Props) {
  const {
    file,
    userId,
    fileHash,
    contentHash,
    merkleRoot,
    leafHashes,
    fileHashMatch,
    contentHashMatch,
    merkleRootMatch,
  } = props;

  const [step, setStep] = useState<Step>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [error, setError] = useState<string>("");
  const [showJson, setShowJson] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedFor = useRef<string | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Reset when file changes
  useEffect(() => {
    stopPoll();
    setStep("idle");
    setReport(null);
    setReportId(null);
    setError("");
    submittedFor.current = null;
  }, [file]);

  // Auto-submit forensic scan for the selected file
  useEffect(() => {
    if (!file || !userId) return;
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (submittedFor.current === key) return;
    submittedFor.current = key;

    (async () => {
      setStep("uploading");
      setError("");
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("user_id", userId);
        fd.append("mode", "full");
        const { data, error: err } = await supabase.functions.invoke("submit-scan", { body: fd });
        if (err) throw new Error(err.message);
        if (data?.error) throw new Error(data.error);
        if (!data?.report_id) throw new Error("Forensic scanner did not return a report id.");
        setReportId(data.report_id);
        setStep(data.status === "queued" ? "queued" : "processing");
      } catch (e: any) {
        setStep("error");
        setError(e.message || "Failed to submit forensic scan");
      }
    })();
  }, [file, userId]);

  // Poll report
  useEffect(() => {
    if (!reportId || (step !== "processing" && step !== "queued")) return;
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("forensic_reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();
      if (!data) return;
      const r = data as ForensicReport;
      setReport(r);
      if (r.status === "complete") {
        setStep("done");
        stopPoll();
      } else if (r.status === "failed") {
        setStep("error");
        setError(r.error_message || "Forensic scan failed");
        stopPoll();
      } else if (r.status === "queued") {
        setStep("queued");
      } else if (r.status === "processing") {
        setStep("processing");
      }
      if (attempts >= 120) {
        setStep("error");
        setError("Scan is taking too long. Try again later.");
        stopPoll();
      }
    }, 5000);
    return stopPoll;
  }, [reportId, step]);

  const downloadJson = () => {
    if (!report?.full_report) return;
    const blob = new Blob([JSON.stringify(report.full_report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forensic-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!file) return null;

  const notable: string[] = (() => {
    const cats = report?.full_report?.categories || {};
    const out: string[] = [];
    Object.values(cats).forEach((cat: any) => {
      if (cat?.results && Array.isArray(cat.results)) {
        cat.results.forEach((r: any) => {
          if (Array.isArray(r.supports)) out.push(...r.supports);
        });
      }
    });
    return out;
  })();

  const HashRow = ({
    label,
    value,
    match,
  }: {
    label: string;
    value?: string;
    match?: boolean;
  }) => (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-card/60 border border-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-primary flex items-center gap-1">
          <Hash className="w-3 h-3" /> {label}
        </span>
        {typeof match === "boolean" && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              match
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }`}
          >
            {match ? "Match" : "No match"}
          </span>
        )}
      </div>
      <code className="text-xs break-all text-muted-foreground">
        {value || "—"}
      </code>
    </div>
  );

  return (
    <section className="section-container">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Forensic + Hash Verification Layer</h3>
        </div>

        {/* Forensic scan card */}
        <div className="p-5 rounded-2xl bg-card/80 border border-border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {step === "done" ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : step === "error" ? (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{report?.file_name || file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {step === "uploading" && "Uploading to forensic scanner…"}
                  {step === "queued" && "Queued — waiting for a free scanner slot…"}
                  {step === "processing" && "Running deep forensic analysis…"}
                  {step === "done" && `Scan complete · ${fmtSize(report?.file_size ?? file.size)}`}
                  {step === "error" && (error || "Scan failed")}
                  {step === "idle" && "Preparing forensic scan…"}
                </p>
              </div>
            </div>
            {report?.risk_level && (
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  report.risk_level === "high"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : report.risk_level === "medium"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                }`}
              >
                {report.risk_level.toUpperCase()} RISK
              </span>
            )}
          </div>

          {step === "done" && report && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border bg-muted/10">
                <p className="text-sm font-semibold mb-2">Findings</p>
                <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
                  {notable.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No notable findings — file appears consistent with genuine content.
                    </p>
                  ) : (
                    notable.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0">
                        {findingIcon(f)}
                        <span className="text-xs leading-relaxed">{f}</span>
                      </div>
                    ))
                  )}
                </div>
                {report.flags && report.flags.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                    {report.flags.map((flag, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={downloadJson}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Full Report (JSON)
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowJson((s) => !s)}>
                  {showJson ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {showJson ? "Hide" : "Show"} raw JSON
                </Button>
              </div>
              {showJson && (
                <pre className="mt-2 p-3 bg-muted/30 rounded-md overflow-auto max-h-60 text-[10px] font-mono">
                  {JSON.stringify(report.full_report, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Hash-generation layer */}
        {(fileHash || contentHash || merkleRoot) && (
          <div className="p-5 rounded-2xl bg-card/80 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Hash Generation Layer</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <HashRow label="File Hash (SHA-256 of bytes)" value={fileHash} match={fileHashMatch} />
              <HashRow label="Content Hash (chunk-aggregated)" value={contentHash} match={contentHashMatch} />
              <div className="md:col-span-2">
                <HashRow label="Merkle Root (evidence tree)" value={merkleRoot} match={merkleRootMatch} />
              </div>
            </div>
            {leafHashes && leafHashes.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-primary">
                  Show evidence chunk hashes ({leafHashes.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-auto space-y-1">
                  {leafHashes.map((lh) => (
                    <div
                      key={lh.index}
                      className="flex items-start gap-2 p-1.5 rounded bg-muted/20"
                    >
                      <span className="text-muted-foreground w-8 shrink-0">#{lh.index}</span>
                      <code className="text-[10px] break-all">{lh.hash}</code>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <p className="text-[11px] text-muted-foreground">
              File, content and evidence hashes are compared against the registered document to prove
              authenticity. Blockchain anchoring will be layered on top of this in the next step.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
