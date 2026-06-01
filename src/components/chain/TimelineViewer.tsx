/**
 * TimelineViewer — queries TimelineLogger events for a specific entity.
 * Reusable in profile/document/process pages.
 */
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useChain, SEPOLIA_EXPLORER } from "@/hooks/useChain";
import { TIMELINE_LOGGER_ADDRESS, TIMELINE_LOGGER_ABI } from "@/lib/contractsExtra";
import { Loader2, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Entry {
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  actor: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

export function TimelineViewer({
  entityType,
  entityId,
  limit = 50,
  title = "On-chain Timeline",
}: {
  entityType?: string;
  entityId?: string;
  limit?: number;
  title?: string;
}) {
  const { readProvider } = useChain();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!TIMELINE_LOGGER_ADDRESS) {
      setError("TimelineLogger not deployed. Set VITE_TIMELINE_LOGGER_ADDRESS in .env.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const c = new ethers.Contract(TIMELINE_LOGGER_ADDRESS, TIMELINE_LOGGER_ABI, readProvider);
      // indexed strings are hashed in topics; pass strings — ethers handles it
      const filter = c.filters.TimelineEntry(
        entityType ?? null,
        entityId ?? null,
      );
      const latest = await readProvider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 200_000); // ~last weeks of Sepolia
      const logs = await c.queryFilter(filter, fromBlock, latest);
      const parsed: Entry[] = logs.slice(-limit).reverse().map((l: any) => ({
        entityType: l.args?.entityType ?? entityType ?? "?",
        entityId: l.args?.entityId ?? entityId ?? "?",
        action: l.args?.action,
        description: l.args?.description,
        actor: l.args?.actor,
        timestamp: Number(l.args?.timestamp ?? 0),
        txHash: l.transactionHash,
        blockNumber: l.blockNumber,
      }));
      setEntries(parsed);
    } catch (e: any) {
      setError(e?.message || "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entityType, entityId]);

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
          {entityId && <Badge variant="outline" className="text-[10px]">{entityType}: {entityId.slice(0, 18)}…</Badge>}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!loading && entries.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">No timeline entries yet.</p>
      )}
      <ol className="relative border-l border-border ml-2 space-y-3">
        {entries.map((e, i) => (
          <li key={i} className="ml-4">
            <div className="absolute w-2 h-2 bg-primary rounded-full -left-1 mt-1.5" />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px]">{e.action}</Badge>
              <span className="text-xs text-muted-foreground">
                {e.timestamp ? new Date(e.timestamp * 1000).toLocaleString() : "—"}
              </span>
            </div>
            <p className="text-sm mt-1">{e.description}</p>
            <div className="text-[10px] text-muted-foreground font-mono mt-1 flex items-center gap-2">
              by {e.actor?.slice(0, 6)}…{e.actor?.slice(-4)}
              <a href={`${SEPOLIA_EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="hover:text-primary flex items-center gap-1">
                tx <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
