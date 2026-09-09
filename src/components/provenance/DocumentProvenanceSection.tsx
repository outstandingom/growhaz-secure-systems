/**
 * DocumentProvenanceSection — public, read-only provenance view for one
 * document: combined verification verdict, blockchain proof and version
 * timeline. Used by the existing public verification page.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertTriangle, Ban, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlockchainProofPanel } from "./BlockchainProofPanel";
import { ProvenanceTimeline } from "./ProvenanceTimeline";
import { evaluateProvenance, type ProvenanceEvaluation } from "@/lib/provenanceVerification";

interface Props {
  documentId?: string | null;
  recordId?: string | null;
  /** Hashes from the existing off-chain verification engine. */
  computed?: {
    fileHash?: string | null;
    contentHash?: string | null;
    merkleRoot?: string | null;
    semanticHash?: string | null;
  };
  semanticAnomaly?: boolean;
}

const verdictStyle = (v: string) => {
  switch (v) {
    case "AUTHENTIC":
      return { icon: ShieldCheck, cls: "bg-primary/10 border-primary/40 text-primary" };
    case "SAFE_RE_EXPORT":
      return { icon: CheckCircle2, cls: "bg-amber-500/10 border-amber-500/40 text-amber-400" };
    case "TAMPERING_DETECTED":
    case "SEMANTIC_ANOMALY":
      return { icon: AlertTriangle, cls: "bg-destructive/10 border-destructive/40 text-destructive" };
    case "REVOKED":
      return { icon: Ban, cls: "bg-destructive/10 border-destructive/40 text-destructive" };
    case "SUPERSEDED":
      return { icon: RefreshCw, cls: "bg-muted border-border text-muted-foreground" };
    default:
      return { icon: AlertTriangle, cls: "bg-card/50 border-border text-muted-foreground" };
  }
};

export function DocumentProvenanceSection({
  documentId,
  recordId,
  computed,
  semanticAnomaly,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<ProvenanceEvaluation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase.from("provenance_records").select("*");
      q = recordId ? q.eq("record_id", recordId) : q.eq("document_id", documentId ?? "");
      const { data: rec } = await q.maybeSingle();
      if (cancelled) return;
      setRecord(rec);

      if (rec) {
        const { data: v } = await supabase
          .from("provenance_versions")
          .select("*")
          .eq("record_id", rec.record_id)
          .order("version", { ascending: false })
          .limit(1);
        const latest = v?.[0] ?? null;
        if (cancelled) return;
        setCurrent(latest);
        if (computed) {
          setEvaluation(
            evaluateProvenance(
              computed,
              latest
                ? {
                    version: latest.version,
                    state: latest.state,
                    fileHash: latest.file_hash,
                    contentHash: latest.content_hash,
                    merkleRoot: latest.merkle_root,
                    semanticHash: latest.semantic_hash,
                  }
                : null,
              { semanticAnomaly }
            )
          );
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, recordId, computed, semanticAnomaly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-4 rounded-xl bg-card/50 border border-border text-sm text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5" />
        Blockchain registration not yet completed for this document.
      </div>
    );
  }

  const style = evaluation ? verdictStyle(evaluation.verdict) : null;
  const Icon = style?.icon;

  return (
    <div className="space-y-4">
      {evaluation && Icon && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${style!.cls}`}>
          <Icon className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              {evaluation.label}
              <Badge variant="outline">V{current?.version}</Badge>
            </div>
            <p className="text-xs mt-1 opacity-90">{evaluation.explanation}</p>
          </div>
        </div>
      )}

      {current?.state === "REVOKED" && !evaluation && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/40 text-sm text-destructive flex items-center gap-2">
          <Ban className="w-4 h-4" /> THIS VERSION HAS BEEN REVOKED.
        </div>
      )}

      <BlockchainProofPanel
        version={
          current
            ? {
                record_id: record.record_id,
                version: current.version,
                file_hash: current.file_hash,
                content_hash: current.content_hash,
                merkle_root: current.merkle_root,
                semantic_hash: current.semantic_hash,
                actor_wallet: current.actor_wallet,
                tx_hash: current.tx_hash,
                block_number: current.block_number,
                block_hash: current.block_hash,
                explorer_url: current.explorer_url,
                contract_address: current.contract_address,
                chain_network: current.chain_network,
                state: current.state,
              }
            : null
        }
      />

      <ProvenanceTimeline recordId={record.record_id} />
    </div>
  );
}
