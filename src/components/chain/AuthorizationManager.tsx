/**
 * AuthorizationManager — organisation grants/revokes employee authorisation
 * for a given process type on AuthorizationRegistry.
 */
import { useState } from "react";
import { useChain } from "@/hooks/useChain";
import { AUTHORIZATION_REGISTRY_ADDRESS, AUTHORIZATION_REGISTRY_ABI } from "@/lib/contractsExtra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export function AuthorizationManager() {
  const { getContract } = useChain();
  const [employee, setEmployee] = useState("");
  const [processType, setProcessType] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">(30);
  const [busy, setBusy] = useState(false);

  const checkAddr = "0x" + employee.replace(/^0x/, "");
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(checkAddr) && processType.trim().length > 0;

  const grant = async () => {
    if (!isValid) return toast.error("Enter valid 0x address + process type");
    setBusy(true);
    try {
      const c = await getContract(AUTHORIZATION_REGISTRY_ADDRESS, AUTHORIZATION_REGISTRY_ABI, { write: true });
      const exp = expiresInDays ? Math.floor(Date.now() / 1000) + Number(expiresInDays) * 86400 : 0;
      const tx = await c.authorise(checkAddr, processType.trim(), exp);
      toast.message("Confirming on-chain…");
      await tx.wait();
      toast.success("Employee authorised");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!isValid) return toast.error("Enter valid 0x address + process type");
    setBusy(true);
    try {
      const c = await getContract(AUTHORIZATION_REGISTRY_ADDRESS, AUTHORIZATION_REGISTRY_ABI, { write: true });
      const tx = await c.revoke(checkAddr, processType.trim());
      await tx.wait();
      toast.success("Authorisation revoked");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Organisation → Employee Authorisation</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Authorise an employee wallet to handle a process type on behalf of your organisation (msg.sender = org).
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Employee wallet</Label>
          <Input value={employee} onChange={e => setEmployee(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
        </div>
        <div>
          <Label className="text-xs">Process type</Label>
          <Input value={processType} onChange={e => setProcessType(e.target.value)} placeholder="property-buy" />
        </div>
        <div>
          <Label className="text-xs">Expires in (days, 0 = never)</Label>
          <Input type="number" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={grant} disabled={busy || !isValid}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
          Authorise
        </Button>
        <Button size="sm" variant="outline" onClick={revoke} disabled={busy || !isValid}>
          <ShieldOff className="w-3 h-3 mr-1" /> Revoke
        </Button>
      </div>
    </div>
  );
}
