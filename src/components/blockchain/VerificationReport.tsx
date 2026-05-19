import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hash,
  User,
  Calendar,
  Building2,
  Award,
  Network,
  ShieldCheck,
  Database,
  FileText,
  Copy,
  ExternalLink,
} from "lucide-react";
import { type VerifyResult } from "@/types/blockchain";
import { MERKLE_DOCUMENT_REGISTRY_ADDRESS } from "@/lib/contractConfig";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

interface VerificationReportProps {
  result: VerifyResult | null;
}

export function VerificationReport({ result }: VerificationReportProps) {
  if (!result) return null;

  const StatusIcon =
    result.validation.status === "authentic"
      ? CheckCircle2
      : result.validation.status === "valid"
      ? CheckCircle2
      : result.validation.status === "suspicious"
      ? AlertTriangle
      : XCircle;

  const isVerifyMode = !!result.matched; // if we have a matched record, it's verify mode

  return (
    <div className="mt-8 space-y-4">
      {/* Status banner */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          result.validation.status === "tampered"
            ? "bg-destructive/10 border-destructive/40"
            : result.validation.status === "suspicious"
            ? "bg-yellow-500/10 border-yellow-500/40"
            : "bg-primary/10 border-primary/40"
        }`}
      >
        <StatusIcon className="w-6 h-6 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold capitalize">{result.validation.status}</span>
            <Badge variant="outline">{result.document_type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {result.validation.explanation}
          </p>
        </div>
      </div>

      {/* Key extracted fields */}
      {result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: "student_name", label: "Owner", icon: User, fallback: result.extracted_data.name },
            { key: "issue_date", label: "Issue Date", icon: Calendar, fallback: result.extracted_data.date },
            { key: "institution", label: "Issuer", icon: Building2 },
            { key: "degree", label: "Title", icon: Award, fallback: result.extracted_data.course },
          ].map(({ key, label, icon: Icon, fallback }) => {
            const value = result.extracted_data[key] || fallback;
            if (!value) return null;
            return (
              <div key={key} className="flex flex-col gap-1 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <span className="text-[10px] uppercase tracking-wide text-primary flex items-center gap-1">
                  <Icon className="w-3 h-3" /> {label}
                </span>
                <span className="text-sm font-semibold break-words">{String(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Dual hash comparison (only in verify mode) */}
      {isVerifyMode && result.matched ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0">
            {/* Uploaded */}
            <div className="p-4 bg-card/50">
              <div className="text-xs font-semibold text-muted-foreground mb-2">UPLOADED FILE</div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> File Hash
                  </div>
                  <code className="text-[10px] break-all">{result.file_hash}</code>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Content Hash
                  </div>
                  <code className="text-[10px] break-all">{result.content_hash}</code>
                </div>
              </div>
            </div>

            {/* Match indicators */}
            <div className="flex md:flex-col items-center justify-around gap-4 p-4 bg-primary/5 border-y md:border-y-0 md:border-x border-border">
              <div className="flex flex-col items-center gap-1">
                {result.fileHashMatch ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="text-[10px] text-center">File {result.fileHashMatch ? "100%" : "differs"}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {result.contentHashMatch ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <span className="text-[10px] text-center">Content {result.contentHashMatch ? "100%" : "differs"}</span>
              </div>
            </div>

            {/* Original */}
            <div className="p-4 bg-card/50">
              <div className="text-xs font-semibold text-muted-foreground mb-2">ORIGINAL ON LEDGER</div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> File Hash
                  </div>
                  <code className="text-[10px] break-all">{result.matched.file_hash}</code>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Content Hash
                  </div>
                  <code className="text-[10px] break-all">{result.matched.content_hash}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-side image previews */}
          {(result.uploadedPreview || result.originalPreview) && (
            <div className="grid grid-cols-2 gap-2 p-2 bg-background border-t border-border">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-center text-muted-foreground">Uploaded</span>
                {result.uploadedPreview && (
                  <img src={result.uploadedPreview} alt="Uploaded document" className="w-full h-48 object-contain rounded-lg bg-card/50 border border-border" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-center text-muted-foreground">Original</span>
                {result.originalPreview ? (
                  <img src={result.originalPreview} alt="Original document" className="w-full h-48 object-contain rounded-lg bg-card/50 border border-border" />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center rounded-lg bg-card/50 border border-border text-xs text-muted-foreground">
                    Preview unavailable
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Hash display for non‑verify mode (e.g., issue) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              <Hash className="w-3 h-3" /> File Hash
            </span>
            <code className="text-xs break-all">{result.file_hash}</code>
            <span className="text-[10px] text-muted-foreground">Detects any byte-level change (resize, re-save, format).</span>
          </div>
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
            <span className="text-xs font-medium text-primary flex items-center gap-1">
              <Hash className="w-3 h-3" /> Content Hash
            </span>
            <code className="text-xs break-all">{result.content_hash}</code>
            <span className="text-[10px] text-muted-foreground">Hash of extracted information — survives format changes.</span>
          </div>
        </div>
      )}

      {/* Merkle Verification Panel */}
      {result.merkle && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-card to-accent/5 border border-primary/20 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Network className="w-4 h-4 text-primary" />
            Merkle Tree Verification
            {result.merkleRootMatch ? (
              <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✓ On-Chain Match</Badge>
            ) : (
              <Badge className="ml-auto" variant="outline">Local Only</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-card/60 border border-border">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Tokens</span>
              <p className="font-medium text-lg">{result.merkle.totalTokens.toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-card/60 border border-border">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Chunks</span>
              <p className="font-medium text-lg">{result.merkle.totalChunks}</p>
            </div>
            <div className="p-2 rounded-lg bg-card/60 border border-border">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Tree Levels</span>
              <p className="font-medium text-lg">{result.merkle.tree.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-card/60 border border-border">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Leaf Hashes</span>
              <p className="font-medium text-lg">{result.merkle.chunkHashes.length}</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-card/60 border border-border">
            <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Merkle Root</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-[10px] break-all flex-1 font-mono">{result.merkle.merkleRoot}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(result.merkle!.merkleRoot); toast.success("Merkle root copied!"); }}
                className="shrink-0"
              >
                <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-1">
              Content → Tokens → Chunks (100 tokens each) → SHA-256 per chunk → Merkle Tree → Root
            </span>
          </div>

          {result.merkle.chunkHashes.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-primary">
                Show {result.merkle.chunkHashes.length} chunk hashes
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg bg-card/60 border border-border">
                {result.merkle.chunkHashes.map((ch) => (
                  <div key={ch.index} className="flex gap-2 font-mono text-[10px]">
                    <span className="text-primary w-8 shrink-0">#{ch.index}</span>
                    <code className="break-all text-muted-foreground">{ch.hash}</code>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* On-Chain Document (from MerkleDocumentRegistry) */}
      {result.onChainDoc?.exists && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            On-Chain Verified Record
            <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Live from Smart Contract</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Issuer Wallet</span>
              <a
                href={`${SEPOLIA_EXPLORER}/address/${result.onChainDoc.issuer}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-primary hover:underline break-all block"
              >
                {result.onChainDoc.issuer}
              </a>
            </div>
            <div>
              <span className="text-muted-foreground">Registered</span>
              <p className="font-medium">
                {result.onChainDoc.timestamp
                  ? new Date(result.onChainDoc.timestamp * 1000).toLocaleString()
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Document Name</span>
              <p className="font-medium">{result.onChainDoc.documentName || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Document Type</span>
              <p className="font-medium">{result.onChainDoc.docType || "—"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">IPFS CID</span>
              {result.onChainDoc.ipfsCid ? (
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${result.onChainDoc.ipfsCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-primary hover:underline break-all block"
                >
                  {result.onChainDoc.ipfsCid}
                </a>
              ) : (
                <p className="text-[10px] text-muted-foreground">—</p>
              )}
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Contract Address</span>
              <a
                href={`${SEPOLIA_EXPLORER}/address/${MERKLE_DOCUMENT_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-primary hover:underline break-all block"
              >
                {MERKLE_DOCUMENT_REGISTRY_ADDRESS}
              </a>
            </div>
            <div>
              <span className="text-muted-foreground">Chunks</span>
              <p className="font-medium">{result.onChainDoc.totalChunks}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tokens</span>
              <p className="font-medium">{result.onChainDoc.totalTokens}</p>
            </div>
          </div>
        </div>
      )}

      {/* Blockchain Index Record (Supabase) */}
      {result.matched?.chain_tx_hash && (
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Blockchain Index Record
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <span className="text-muted-foreground">Transaction Hash</span>
              <a
                href={`${SEPOLIA_EXPLORER}/tx/${result.matched.chain_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-primary hover:underline break-all flex items-center gap-1"
              >
                {result.matched.chain_tx_hash} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
            {result.matched.chain_issuer_address && (
              <div>
                <span className="text-muted-foreground">Issuer Wallet</span>
                <code className="text-[10px] break-all block">{result.matched.chain_issuer_address}</code>
              </div>
            )}
            {result.matched.chain_contract_address && (
              <div>
                <span className="text-muted-foreground">Contract</span>
                <code className="text-[10px] break-all block">{result.matched.chain_contract_address}</code>
              </div>
            )}
            {result.matched.chain_block_number && (
              <div>
                <span className="text-muted-foreground">Block</span>
                <p className="font-medium">{result.matched.chain_block_number}</p>
              </div>
            )}
            {result.matched.ipfs_cid && (
              <div>
                <span className="text-muted-foreground">IPFS</span>
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${result.matched.ipfs_cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline break-all"
                >
                  {result.matched.ipfs_cid}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw extracted data */}
      {result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
        <div className="p-4 rounded-xl bg-card/50 border border-border">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Extracted Information
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(result.extracted_data).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-medium break-words">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
          }
