/**
 * AnchorOnChain — user-confirmed, gasless blockchain anchoring.
 * The platform wallet signs the transaction and pays network fees;
 * the user pays in coins and receives a transaction hash + block hash.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Loader2,
  Link2,
  Copy,
  ExternalLink,
  Coins,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

export const ANCHOR_PRICE_COINS = 99;

export interface AnchorResult {
  txHash: string;
  blockHash: string | null;
  blockNumber: number | null;
  explorerUrl: string;
  network: string;
  contractAddress: string;
  issuer?: string;
}

interface Props {
  documentId: string;
  documentName: string;
  anchorStatus?: string | null;
  txHash?: string | null;
  blockHash?: string | null;
  blockNumber?: number | null;
  explorerUrl?: string | null;
  onAnchored?: (r: AnchorResult) => void;
  size?: "sm" | "default";
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-card/50 border border-border">
      <span className="text-xs font-medium text-primary">{label}</span>
      <div className="flex items-start gap-2">
        <code className="text-xs break-all flex-1">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Copy ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AnchorOnChain({
  documentId,
  documentName,
  anchorStatus,
  txHash,
  blockHash,
  blockNumber,
  explorerUrl,
  onAnchored,
  size = "sm",
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnchorResult | null>(
    txHash
      ? {
          txHash,
          blockHash: blockHash ?? null,
          blockNumber: blockNumber ?? null,
          explorerUrl: explorerUrl ?? `https://sepolia.etherscan.io/tx/${txHash}`,
          network: "sepolia",
          contractAddress: "",
        }
      : null
  );

  const anchored = anchorStatus === "anchored" || !!result?.txHash;
  const shareUrl = `${window.location.origin}/verify/${documentId}`;

  const anchor = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("anchor-document", {
        body: { documentId, action: "anchor" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const r: AnchorResult = {
        txHash: data.txHash,
        blockHash: data.blockHash ?? null,
        blockNumber: data.blockNumber ?? null,
        explorerUrl: data.explorerUrl,
        network: data.network,
        contractAddress: data.contractAddress,
        issuer: data.issuer,
      };
      setResult(r);
      setConfirmOpen(false);
      setReceiptOpen(true);
      onAnchored?.(r);
      toast.success(
        data.alreadyAnchored
          ? "This document is already on the blockchain"
          : "Recorded on the blockchain"
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not record on the blockchain");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {anchored ? (
        <Button variant="outline" size={size} onClick={() => setReceiptOpen(true)}>
          <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" /> Proof
        </Button>
      ) : (
        <Button variant="hero" size={size} onClick={() => setConfirmOpen(true)}>
          <Link2 className="w-4 h-4 mr-1" /> Secure on blockchain
        </Button>
      )}

      {/* Confirmation — nothing happens without the user's explicit approval */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Secure this document on the blockchain</DialogTitle>
          <DialogDescription>
            A permanent, tamper-proof record of “{documentName}” will be written to a
            public blockchain. You do not need a crypto wallet — we handle the network
            fees for you.
          </DialogDescription>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl bg-card/50 border border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">What is stored</span>
                <span className="font-medium">Hashes only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">Ethereum Sepolia</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You receive</span>
                <span className="font-medium">Transaction + block hash</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-muted-foreground">Price</span>
                <Badge className="bg-primary/15 text-primary border-primary/30">
                  <Coins className="w-3 h-3 mr-1" /> {ANCHOR_PRICE_COINS} coins
                </Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              Your file never leaves your account — only its fingerprints are published.
              This record cannot be deleted once written.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button variant="hero" className="flex-1" onClick={anchor} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Writing…
                  </>
                ) : (
                  <>Confirm &amp; pay {ANCHOR_PRICE_COINS}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt / share */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Blockchain proof
          </DialogTitle>
          <DialogDescription>
            Share this proof or the QR code — anyone can check it independently.
          </DialogDescription>

          <div className="space-y-3 pt-1">
            {result?.txHash && <CopyRow label="Transaction hash" value={result.txHash} />}
            {result?.blockHash && <CopyRow label="Block hash" value={result.blockHash} />}
            {result?.blockNumber != null && (
              <CopyRow label="Block number" value={String(result.blockNumber)} />
            )}
            {result?.contractAddress && (
              <CopyRow label="Registry contract" value={result.contractAddress} />
            )}
            <CopyRow label="Public verification link" value={shareUrl} />

            <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card/50 border border-border">
              <div className="p-3 rounded-xl bg-white">
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan to open the public verification page for “{documentName}”.
              </p>
            </div>

            <div className="flex gap-2">
              {result?.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-1" /> View on explorer
                  </Button>
                </a>
              )}
              <Button
                variant="hero"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("Verification link copied");
                }}
              >
                <Copy className="w-4 h-4 mr-1" /> Copy share link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
