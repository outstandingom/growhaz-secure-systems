/**
 * DemoUserRegistry — simulates the on-chain UserRegistry contract using a
 * Supabase table so we can demo registrations without paying gas.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Row = {
  id: string;
  owner_id: string;
  wallet_address: string;
  name: string;
  profession: string | null;
  phone_hash: string | null;
  ipfs_cid: string | null;
  registered_at: string;
};

async function sha256(s: string) {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return "0x" + Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function DemoUserRegistry() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [phone, setPhone] = useState("");
  const [ipfs, setIpfs] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("demo_user_registry").select("*").order("registered_at", { ascending: false }).limit(100);
    setRows((data as Row[]) || []);
  }

  async function register() {
    if (!userId) return toast({ title: "Please sign in" });
    if (!wallet.trim() || !name.trim()) return toast({ title: "Wallet and name are required" });
    const phone_hash = phone ? await sha256(phone) : null;
    const { error } = await supabase.from("demo_user_registry").insert({
      owner_id: userId,
      wallet_address: wallet.trim(),
      name: name.trim(),
      profession: profession.trim() || null,
      phone_hash,
      ipfs_cid: ipfs.trim() || null,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setWallet(""); setName(""); setProfession(""); setPhone(""); setIpfs("");
    toast({ title: "User registered" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this registration?")) return;
    await supabase.from("demo_user_registry").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="site-glass">
        <CardHeader><CardTitle className="text-base">Register User</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Wallet address (0x...)" value={wallet} onChange={(e) => setWallet(e.target.value)} />
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} />
            <Input placeholder="Phone (hashed)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Input placeholder="IPFS CID (optional)" value={ipfs} onChange={(e) => setIpfs(e.target.value)} />
          <Button onClick={register} className="w-full"><Plus className="w-4 h-4 mr-1" /> Register</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No registrations yet.</p>}
        {rows.map((r) => (
          <Card key={r.id} className="site-glass">
            <CardContent className="pt-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1">{r.name}</span>
                {r.profession && <Badge variant="outline" className="text-[10px]">{r.profession}</Badge>}
                {r.owner_id === userId && (
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                )}
              </div>
              <p className="text-[10px] font-mono break-all text-muted-foreground">{r.wallet_address}</p>
              {r.phone_hash && <p className="text-[10px] font-mono break-all">📞 {r.phone_hash.slice(0, 24)}…</p>}
              {r.ipfs_cid && <p className="text-[10px] font-mono break-all">📦 ipfs://{r.ipfs_cid}</p>}
              <p className="text-[10px] text-muted-foreground">{new Date(r.registered_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
