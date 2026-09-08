/**
 * BlockchainProofPanel — shows the Arbitrum proof for one document version.
 * Isolated to the Document Verification module.
 */
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { PROVENANCE_NETWORK, txUrl, addressUrl } from "@/lib/provenanceConfig";

export interface ProofVersion {
  record_id: string;
  version: number;
  file_hash?: string | null;
  content_hash?: string | null;
  merkle_root?: string | null;
  semantic_hash?: string | null;
  actor_wallet?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  block_hash?: string | null;
  explorer_url?: string | null;
  contract_address?: string | null;
  chain_network?: string | null;
  state?: string | null;
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="text-xs break-all">{String(value)}</code>
    </div>
  );
}

export function BlockchainProofPanel({ version }: { version?: ProofVersion | null }) {
  if (!version || !version.tx_hash) {
    return (
      <div className="p-4 rounded-xl bg-card/50 border border-border flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5" />
        <div>
          <div className="text-sm font-semibold">Blockchain Proof</div>
          <p className="text-xs text-muted-foreground mt-1">
            Blockchain registration not yet completed.
          </p>
        </div>
      </div>
    );
  }

  const explorer = version.explorer_url || txUrl(version.tx_hash);

  return (
    <div className="p-4 rounded-xl bg-primary/5 border border-primary/30 space-y-3">
      <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-primary" /> Blockchain Proof
        <Badge variant="outline" className="ml-auto capitalize">
          {version.chain_network || PROVENANCE_NETWORK.name}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Row label="Record ID" value={version.record_id} />
        <Row label="Version" value={`V${version.version}`} />
        <Row label="Registry" value={version.contract_address} />
        <Row label="Transaction" value={version.tx_hash} />
        <Row label="Block" value={version.block_number} />
        <Row label="Block hash" value={version.block_hash} />
        <Row label="Actor" value={version.actor_wallet} />
        <Row label="State" value={version.state} />
        <Row label="File hash" value={version.file_hash} />
        <Row label="Content hash" value={version.content_hash} />
        <Row label="Merkle root" value={version.merkle_root} />
        <Row label="Semantic hash" value={version.semantic_hash} />
      </div>

      <div className="flex flex-wrap gap-4">
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary inline-flex items-center gap-1"
        >
          View on Arbitrum Explorer <ExternalLink className="w-3 h-3" />
        </a>
        {version.contract_address && (
          <a
            href={addressUrl(version.contract_address)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1"
          >
            View registry contract <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
