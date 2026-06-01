/**
 * DocumentStatusBadge — read-only badge for a docId's on-chain status.
 */
import { useEffect, useState } from "react";
import { useChain } from "@/hooks/useChain";
import {
  DOCUMENT_STATUS_TRACKER_ADDRESS,
  DOCUMENT_STATUS_TRACKER_ABI,
} from "@/lib/contractsExtra";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const COLOR: Record<string, string> = {
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "in-review": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "in-progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function DocumentStatusBadge({ docId }: { docId: string }) {
  const { readProvider } = useChain();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId || !DOCUMENT_STATUS_TRACKER_ADDRESS) return;
    setLoading(true);
    (async () => {
      try {
        const { ethers } = await import("ethers");
        const c = new ethers.Contract(DOCUMENT_STATUS_TRACKER_ADDRESS, DOCUMENT_STATUS_TRACKER_ABI, readProvider);
        const s: string = await c.statuses(docId);
        setStatus(s || "unknown");
      } catch { setStatus("unknown"); }
      finally { setLoading(false); }
    })();
  }, [docId, readProvider]);

  if (loading) return <Badge variant="outline" className="text-[10px]"><Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> status</Badge>;
  if (!status || status === "unknown") return <Badge variant="outline" className="text-[10px]">no status</Badge>;
  return <Badge className={`text-[10px] ${COLOR[status] || ""}`}>{status}</Badge>;
}
