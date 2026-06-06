/**
 * UserRegistryPanel — register/update an on-chain profile on the freshly
 * deployed UserRegistry (contracts/UserRegistry.sol).
 *
 * Flow:
 *   1. User fills name / role / phone / email.
 *   2. We pin the JSON profile to IPFS via Pinata.
 *   3. We call UserRegistry.registerOrUpdate(ipfsCid) which logs to TimelineLogger.
 */
import { useState, useEffect } from "react";
import { useChain, SEPOLIA_EXPLORER } from "@/hooks/useChain";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import {
  USER_REGISTRY_V2_ADDRESS,
  USER_REGISTRY_V2_ABI,
  isUserRegistryV2Deployed,
} from "@/lib/userRegistryV2Contract";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus, ExternalLink, RefreshCw, Check } from "lucide-react";

function b64(s: string) { return btoa(unescape(encodeURIComponent(s))); }

export function UserRegistryPanel() {
  const { getContract } = useChain();
  const { walletAddress } = useWeb3Wallet();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("individual");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [profile, setProfile] = useState<{ ipfsHash: string; updatedAt: number } | null>(null);

  const refresh = async () => {
    if (!walletAddress || !isUserRegistryV2Deployed()) return;
    try {
      const c = await getContract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI);
      const [ipfsHash, updatedAt] = await c.getProfile(walletAddress);
      setProfile({ ipfsHash, updatedAt: Number(updatedAt) });
    } catch (e) { /* not registered yet */ setProfile(null); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [walletAddress]);

  const register = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (!walletAddress) return toast.error("Connect MetaMask first");
    setBusy(true);
    try {
      const json = JSON.stringify({
        wallet: walletAddress,
        name: name.trim(),
        role,
        organisationName: orgName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        registeredAt: new Date().toISOString(),
      }, null, 2);

      toast.message("Pinning profile to IPFS…");
      const { data: pin, error } = await supabase.functions.invoke("pinata-upload", {
        body: { fileBase64: b64(json), fileName: `profile-${walletAddress}.json`, mimeType: "application/json" },
      });
      if (error) throw error;
      if (pin?.error) throw new Error(pin.error);

      toast.message("Sending registerOrUpdate on-chain…");
      const c = await getContract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI, { write: true });
      const tx = await c.registerOrUpdate(pin.cid);
      toast.message("Confirming…");
      const receipt = await tx.wait();
      toast.success("Registered on-chain ✓");
      console.log("[UserRegistry] tx:", receipt.hash);
      await refresh();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.reason || e?.message || "Failed");
    } finally { setBusy(false); }
  };

  if (!isUserRegistryV2Deployed()) {
    return (
      <div className="rounded-xl bg-card/50 border border-border p-4 text-sm text-muted-foreground">
        UserRegistry not configured. Set <code>VITE_USER_REGISTRY_V2_ADDRESS</code> in .env.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">On-Chain User Registry</h3>
        {profile && profile.updatedAt > 0 && (
          <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
            <Check className="w-3 h-3" /> registered
          </Badge>
        )}
      </div>

      {profile && profile.updatedAt > 0 && (
        <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
          <p className="text-muted-foreground">Last on-chain update: {new Date(profile.updatedAt * 1000).toLocaleString()}</p>
          <a href={`https://gateway.pinata.cloud/ipfs/${profile.ipfsHash}`} target="_blank" rel="noreferrer"
             className="text-primary hover:underline flex items-center gap-1 break-all">
            <ExternalLink className="w-3 h-3" /> profile IPFS: {profile.ipfsHash}
          </a>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Full name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={role} onChange={e => setRole(e.target.value)}>
            <option value="individual">Individual</option>
            <option value="organisation">Organisation</option>
            <option value="agent">Agent / Employee</option>
          </select>
        </div>
        {role === "organisation" && (
          <div className="sm:col-span-2">
            <Label className="text-xs">Organisation name</Label>
            <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
        )}
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={register} disabled={busy || !walletAddress}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
          {profile && profile.updatedAt > 0 ? "Update profile" : "Register on-chain"}
        </Button>
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
        <a href={`${SEPOLIA_EXPLORER}/address/${USER_REGISTRY_V2_ADDRESS}`} target="_blank" rel="noreferrer"
           className="text-[11px] text-primary hover:underline flex items-center gap-1 ml-auto">
          <ExternalLink className="w-3 h-3" /> contract on Etherscan
        </a>
      </div>
    </div>
  );
}
