import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSearch, Loader2, Eye, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface ForensicReport {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  mode: string | null;
  status: string;
  risk_score: number | null;
  risk_level: string | null;
  explanation_summary: string | null;
  flags: any;
  full_report: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Props {
  userId: string;
}

const riskColor = (level: string | null) => {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function MyForensicReports({ userId }: Props) {
  const [reports, setReports] = useState<ForensicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ForensicReport | null>(null);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("forensic_reports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setReports((data as ForensicReport[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const downloadJson = (r: ForensicReport) => {
    const blob = new Blob([JSON.stringify(r.full_report ?? r, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forensic-report-${r.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-card/50 border border-border">
        <FileSearch className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No forensic reports yet</h3>
        <p className="text-muted-foreground">
          Run a scan with the Forensic tool to see reports appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Forensic Reports ({reports.length})</h2>
          <Button variant="outline" size="sm" onClick={fetchReports} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-card/50 border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold truncate">{r.file_name}</h3>
                  {r.risk_level && (
                    <Badge variant="outline" className={riskColor(r.risk_level)}>
                      {r.risk_level}
                      {r.risk_score !== null ? ` · ${r.risk_score}` : ""}
                    </Badge>
                  )}
                  {r.mode && <Badge variant="secondary">{r.mode}</Badge>}
                  {r.status !== "complete" && (
                    <Badge variant="outline">{r.status}</Badge>
                  )}
                </div>
                {r.explanation_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {r.explanation_summary}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(r.created_at), "PPp")}
                  {r.file_size ? ` · ${(r.file_size / 1024).toFixed(1)} KB` : ""}
                </p>
                {r.status === "failed" && r.error_message && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {r.error_message}
                  </p>
                )}
              </div>

              <div className="flex gap-2 md:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(r)}
                  disabled={r.status !== "complete"}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" /> View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadJson(r)}
                  disabled={r.status !== "complete"}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> JSON
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.file_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selected.risk_level && (
                  <Badge variant="outline" className={riskColor(selected.risk_level)}>
                    Risk: {selected.risk_level} ({selected.risk_score ?? "—"})
                  </Badge>
                )}
                {selected.mode && <Badge variant="secondary">{selected.mode}</Badge>}
              </div>
              {selected.explanation_summary && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Summary</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selected.explanation_summary}
                  </p>
                </div>
              )}
              {Array.isArray(selected.flags) && selected.flags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Flags</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    {selected.flags.map((f: any, i: number) => (
                      <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.full_report && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Full Report</h4>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-96">
                    {JSON.stringify(selected.full_report, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        
      </Dialog>
    </>
  );
}
