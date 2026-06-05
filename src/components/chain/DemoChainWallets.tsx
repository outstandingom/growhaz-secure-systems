/**
 * DemoChainWallets — simple wallet ledger for demo purposes. Stores wallet
 * label + display balance in Supabase so we can showcase wallet UX.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet as WalletIcon } from "lucide-react";

type Wallet = {
  id: string;
  owner_id: string;
  wallet_address: string;
  label: string | null;
  display_balance: string | null;
  network: string;
  created_at: string;
};

export function DemoChainWallets() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Wallet[]>([]);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("demo_chain_wallets").select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data as Wallet[]) || []);
  }

  async function add() {
    if (!userId) return toast({ title: "Please sign in" });
    if (!addr.trim()) return toast({ title: "Wallet address required" });
    const { error } = await supabase.from("demo_chain_wallets").insert({
      owner_id: userId,
      wallet_address: addr.trim(),
      label: label.trim() || null,
      display_balance: balance.trim() || "0",
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setAddr(""); setLabel(""); setBalance("0");
    toast({ title: "Wallet added" });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Remove this wallet?")) return;
    await supabase.from("demo_chain_wallets").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="site-glass">
        <CardHeader><CardTitle className="text-base">Add Wallet</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="0x address" value={addr} onChange={(e) => setAddr(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Label (e.g. Main)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input placeholder="Display balance (POL)" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
          <Button onClick={add} className="w-full"><Plus className="w-4 h-4 mr-1" /> Add Wallet</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No wallets yet.</p>}
        {rows.map((w) => (
          <Card key={w.id} className="site-glass">
            <CardContent className="pt-4 space-y-1">
              <div className="flex items-center gap-2">
                <WalletIcon className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm flex-1">{w.label || "Unnamed"}</span>
                <Badge variant="outline" className="text-[10px]">{w.network}</Badge>
                {w.owner_id === userId && (
                  <Button size="icon" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                )}
              </div>
              <p className="text-[10px] font-mono break-all text-muted-foreground">{w.wallet_address}</p>
              <p className="text-sm font-mono">{w.display_balance} POL</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
