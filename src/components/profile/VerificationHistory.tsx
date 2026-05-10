import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Hash, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Log {
  id: string;
  document_name: string;
  file_hash: string;
  content_hash: string;
  file_hash_match: boolean;
  content_hash_match: boolean;
  status: string;
  matched_document_id: string | null;
  created_at: string;
}

export function VerificationHistory({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("verification_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as Log[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No verifications yet</h3>
        <p className="text-muted-foreground mb-6">
          Documents you verify will appear here.
        </p>
        <Link to="/blockchain">
          <Button variant="hero">Verify a Document</Button>
        </Link>
      </div>
    );
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
      authentic: { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
      valid: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", Icon: CheckCircle2 },
      suspicious: { cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", Icon: AlertTriangle },
      tampered: { cls: "bg-red-500/20 text-red-400 border-red-500/30", Icon: XCircle },
    };
    const { cls, Icon } = map[status] || map.tampered;
    return (
      <Badge className={cls}>
        <Icon className="w-3 h-3 mr-1" /> {status}
      </Badge>
    );
  };

  return (
    <div className="grid gap-3">
      {logs.map((l) => (
        <div
          key={l.id}
          className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-border"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{l.document_name}</h3>
                <StatusBadge status={l.status} />
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <span className={`flex items-center gap-1 ${l.file_hash_match ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {l.file_hash_match ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  File hash {l.file_hash_match ? "matched" : "differs"}
                </span>
                <span className={`flex items-center gap-1 ${l.content_hash_match ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {l.content_hash_match ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  Content hash {l.content_hash_match ? "matched 100%" : "differs"}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Hash className="w-3 h-3" />
                <code className="truncate">{l.content_hash.slice(0, 28)}…</code>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(l.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            {l.matched_document_id && (
              <Link to={`/verify/${l.matched_document_id}`}>
                <Button variant="outline" size="sm">View</Button>
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
