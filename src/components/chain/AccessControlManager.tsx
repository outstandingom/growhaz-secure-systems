/**
 * AccessControlManager — owner grants/revokes viewer access to a docId.
 * Uses already-deployed DocumentAccessControl contract.
 */
import { useState } from "react";
import { useChain } from "@/hooks/useChain";
import { DOCUMENT_ACCESS_CONTROL_ADDRESS, DOCUMENT_ACCESS_CONTROL_ABI } from "@/lib/contractConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, X } from "lucide-react";

export function AccessControlManager({ defaultDocId }: { defaultDocId?: string }) {
  const { getContract } = useChain();
  const [docId, setDocId] = useState(defaultDocId || "");
  const [viewer, setViewer] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">(0);
  const [busy, setBusy] = useState(false);

  const validViewer = /^0x[a-fA-F0-9]{40}$/.test(viewer);
  const valid = validViewer && docId.trim().length > 0;

  const grant = async () => {
    if (!valid) return toast.error("Enter document ID + valid viewer wallet");
    setBusy(true);
    try {
      const c = await getContract(DOCUMENT_ACCESS_CONTROL_ADDRESS, DOCUMENT_ACCESS_CONTROL_ABI, { write: true });
      const exp = expiresInDays ? Math.floor(Date.now() / 1000) + Number(expiresInDays) * 86400 : 0;
      const tx = await c.grantAccess(docId.trim(), viewer, exp);
      toast.message("Confirming on-chain…");
      await tx.wait();
      toast.success("Access granted");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!valid) return toast.error("Enter document ID + valid viewer wallet");
    setBusy(true);
    try {
      const c = await getContract(DOCUMENT_ACCESS_CONTROL_ADDRESS, DOCUMENT_ACCESS_CONTROL_ABI, { write: true });
      const tx = await c.revokeAccess(docId.trim(), viewer);
      await tx.wait();
      toast.success("Access revoked");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Document Access Control</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Only wallets you grant can view documents you own. Set expiry to 0 for permanent.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Document ID</Label>
          <Input value={docId} onChange={e => setDocId(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Viewer wallet</Label>
          <Input value={viewer} onChange={e => setViewer(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
        </div>
        <div>
          <Label className="text-xs">Expiry (days, 0 = never)</Label>
          <Input type="number" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={grant} disabled={busy || !valid}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <KeyRound className="w-3 h-3 mr-1" />} Grant
        </Button>
        <Button size="sm" variant="outline" onClick={revoke} disabled={busy || !valid}>
          <X className="w-3 h-3 mr-1" /> Revoke
        </Button>
      </div>
    </div>
  );
}
