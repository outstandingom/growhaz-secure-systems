/**
 * UniversalSearch — search by docId / tx / wallet / file hash with optional QR scan.
 * On submit it triggers useBlockchainLookup and renders timeline + result snapshot.
 */
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBlockchainLookup } from "@/hooks/useBlockchainLookup";
import { Search, QrCode, Loader2, X } from "lucide-react";
import { TimelineViewer } from "./TimelineViewer";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

export function UniversalSearch({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [q, setQ] = useState(defaultQuery);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { lookup, result, loading, clear } = useBlockchainLookup();

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  const startScan = async () => {
    setScanning(true);
    try {
      const html5 = new Html5Qrcode("qr-reader");
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decoded) => {
          setQ(decoded);
          lookup(decoded);
          html5.stop().catch(() => {});
          setScanning(false);
        },
        () => { /* ignore frame errors */ },
      );
    } catch {
      setScanning(false);
    }
  };

  const stopScan = async () => {
    await scannerRef.current?.stop().catch(() => {});
    setScanning(false);
  };

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); if (q.trim()) lookup(q.trim()); };

  // Derive a "timeline entity" — prefer document_id from any matching record
  const docId =
    result?.documentRegistrations[0]?.document_id ||
    result?.contractDocData?.docId ||
    (result?.inputType === "doc_id" ? q : undefined);
  const walletForTimeline =
    result?.userRegistrations[0]?.wallet_address ||
    (result?.inputType === "wallet" ? q : undefined);

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Document ID / wallet 0x… / tx hash / file SHA-256" />
        <Button type="submit" size="sm" disabled={loading || !q.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={scanning ? stopScan : startScan}>
          {scanning ? <X className="w-3 h-3" /> : <QrCode className="w-3 h-3" />}
        </Button>
        {result && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { clear(); setQ(""); }}>
            Clear
          </Button>
        )}
      </form>
      <div id="qr-reader" className={scanning ? "rounded-lg overflow-hidden border border-border" : "hidden"} />

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline">Input: {result.inputType}</Badge>
            <Badge variant="outline">{result.userRegistrations.length} user reg(s)</Badge>
            <Badge variant="outline">{result.documentRegistrations.length} doc(s)</Badge>
            <Badge variant="outline">{result.accessGrants.length} access grant(s)</Badge>
            {docId && <DocumentStatusBadge docId={docId} />}
          </div>

          {result.contractUserData?.exists && (
            <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1">
              <p><strong>{result.contractUserData.name}</strong> · {result.contractUserData.profession}</p>
              <p className="font-mono text-[10px]">{result.contractUserData.walletAddress}</p>
              <p className="text-muted-foreground">IPFS: {result.contractUserData.ipfsCid}</p>
            </div>
          )}

          {(docId || walletForTimeline) && (
            <TimelineViewer
              entityType={docId ? "document" : "user"}
              entityId={docId || walletForTimeline}
              title="Timeline for result"
            />
          )}
        </div>
      )}
    </div>
  );
}
