/**
 * ProvenanceTimeline — versioned, tamper-evident history of one document.
 * Reads the mirrored rows from Supabase and (when available) cross-checks the
 * live Arbitrum registry. Isolated to the Document Verification module.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Ban, ArrowDown, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProvenance, type ChainVersion } from "@/hooks/useProvenance";
import { txUrl } from "@/lib/provenanceConfig";

export interface TimelineVersion {
  record_id: string;
  version: number;
  previous_version: number | null;
  event_type: string;
  state: string;
  file_hash: string | null;
  content_hash: string | null;
  merkle_root: string | null;
  semantic_hash: string | null;
  actor_wallet: string | null;
  issuer_wallet: string | null;
  tx_hash: string | null;
  block_number: number | null;
  explorer_url: string | null;
  created_at: string;
}

const short = (v?: string | null, n = 10) =>
  !v ? "—" : v.length <= n * 2 ? v : `${v.slice(0, n)}…${v.slice(-4)}`;

function stateBadge(state: string) {
  if (state === "REVOKED")
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">REVOKED</Badge>;
  if (state === "SUPERSEDED")
    return <Badge variant="secondary">SUPERSEDED</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ACTIVE</Badge>;
}

export function ProvenanceTimeline({
  recordId,
  refreshKey = 0,
}: {
  recordId: string;
  refreshKey?: number;
}) {
  const [versions, setVersions] = useState<TimelineVersion[]>([]);
  const [attestations, setAttestations] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [chainChecked, setChainChecked] = useState<null | boolean>(null);
  const { getVersionHistory, configured } = useProvenance();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: v }, { data: a }] = await Promise.all([
        supabase
          .from("provenance_versions")
          .select("*")
          .eq("record_id", recordId)
          .order("version", { ascending: true }),
        supabase.from("provenance_attestations").select("*").eq("record_id", recordId),
      ]);
      if (cancelled) return;
      setVersions((v as TimelineVersion[]) || []);
      const grouped: Record<number, any[]> = {};
      (a || []).forEach((row: any) => {
        grouped[row.version] = [...(grouped[row.version] || []), row];
      });
      setAttestations(grouped);
      setLoading(false);

      if (configured && v && v.length) {
        try {
          const chain: ChainVersion[] = await getVersionHistory(recordId);
          if (cancelled) return;
          const ok =
            chain.length >= v.length &&
            v.every((row) => {
              const c = chain.find((x) => x.version === row.version);
              return (
                !!c &&
                (!row.content_hash || c.contentHash === row.content_hash) &&
                (!row.file_hash || c.fileHash === row.file_hash)
              );
            });
          setChainChecked(ok);
        } catch {
          if (!cancelled) setChainChecked(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId, refreshKey, configured, getVersionHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!versions.length) {
    return (
      <div className="p-4 rounded-xl bg-card/50 border border-border text-sm text-muted-foreground">
        No provenance history yet for this document.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">Document Provenance</span>
        <code className="text-xs text-muted-foreground">{recordId}</code>
        {chainChecked === true && (
          <Badge className="bg-primary/15 text-primary border-primary/30 ml-auto">
            <ShieldCheck className="w-3 h-3 mr-1" /> Matches on-chain record
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        {versions.map((v, i) => (
          <div key={v.version}>
            <div className="p-4 rounded-xl bg-card/50 border border-border space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  V{v.version} — {v.event_type}
                </span>
                {stateBadge(v.state)}
                {v.previous_version ? (
                  <span className="text-xs text-muted-foreground">
                    previous: V{v.previous_version}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {v.issuer_wallet && (
                  <div>
                    <span className="text-muted-foreground">Issuer: </span>
                    <code>{short(v.issuer_wallet, 6)}</code>
                  </div>
                )}
                {v.actor_wallet && (
                  <div>
                    <span className="text-muted-foreground">Actor: </span>
                    <code>{short(v.actor_wallet, 6)}</code>
                  </div>
                )}
                {v.file_hash && (
                  <div>
                    <span className="text-muted-foreground">File hash: </span>
                    <code>{short(v.file_hash)}</code>
                  </div>
                )}
                {v.content_hash && (
                  <div>
                    <span className="text-muted-foreground">Content hash: </span>
                    <code>{short(v.content_hash)}</code>
                  </div>
                )}
                {v.merkle_root && (
                  <div>
                    <span className="text-muted-foreground">Merkle root: </span>
                    <code>{short(v.merkle_root)}</code>
                  </div>
                )}
                {v.semantic_hash && (
                  <div>
                    <span className="text-muted-foreground">Semantic hash: </span>
                    <code>{short(v.semantic_hash)}</code>
                  </div>
                )}
              </div>

              {(attestations[v.version] || []).map((a) => (
                <div key={a.id} className="text-xs flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="font-medium">{a.role}</span>
                  <code className="text-muted-foreground">{short(a.actor_wallet, 6)}</code>
                  {a.statement && <span className="text-muted-foreground">— {a.statement}</span>}
                </div>
              ))}

              {v.state === "REVOKED" && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <Ban className="w-3 h-3" /> THIS VERSION HAS BEEN REVOKED.
                </div>
              )}

              {v.tx_hash ? (
                <a
                  href={v.explorer_url || txUrl(v.tx_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1"
                >
                  Arbitrum Tx {short(v.tx_hash, 8)} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Blockchain registration not yet completed.
                </p>
              )}
            </div>

            {i < versions.length - 1 && (
              <div className="flex justify-center py-1 text-muted-foreground">
                <ArrowDown className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
