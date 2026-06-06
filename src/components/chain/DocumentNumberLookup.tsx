/**
 * DocumentNumberLookup — search a document by its unique number / id and
 * surface everything on-chain about it:
 *   • DocumentStatusTracker.statuses(docId) — current status
 *   • StepManager instance (entityType="document") + every step
 *   • DocumentAccessControl viewers
 *   • TimelineLogger entries (entityType="document", entityId=docId)
 *
 * One input ⇒ full audit trail.
 */
import { useState } from "react";
import { useChain, SEPOLIA_EXPLORER } from "@/hooks/useChain";
import {
  DOCUMENT_STATUS_TRACKER_ADDRESS,
  DOCUMENT_STATUS_TRACKER_ABI,
} from "@/lib/contractsExtra";
import {
  STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, STEP_STATUS, stepInstanceKey,
} from "@/lib/stepManagerContract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, FileSearch, ExternalLink, Hash } from "lucide-react";
import { TimelineViewer } from "./TimelineViewer";

interface Step { id: number; title: string; assignee: string; actor: string; verifier: string; evidenceHash: string; status: string; }

export function DocumentNumberLookup() {
  const { getContract } = useChain();
  const [docId, setDocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [instanceExists, setInstanceExists] = useState<boolean | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!docId.trim()) return toast.error("Enter a document number");
    setBusy(true); setSearched(true); setSteps([]); setStatus(null); setInstanceExists(null);
    try {
      // status
      try {
        const st = await getContract(DOCUMENT_STATUS_TRACKER_ADDRESS, DOCUMENT_STATUS_TRACKER_ABI);
        const s = await st.statuses(docId.trim());
        setStatus(s || "—");
      } catch (e) { setStatus("—"); }

      // steps
      try {
        const sm = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI);
        const key = stepInstanceKey("document", docId.trim());
        const inst = await sm.instances(key);
        setInstanceExists(!!inst?.exists);
        if (inst?.exists) {
          const count = Number(await sm.getStepCount(key));
          const out: Step[] = [];
          for (let i = 1; i <= count; i++) {
            const s = await sm.getStep(key, i);
            out.push({
              id: Number(s.id), title: s.title, assignee: s.assignee,
              actor: s.actor, verifier: s.verifier, evidenceHash: s.evidenceHash,
              status: STEP_STATUS[Number(s.status)] || "Unknown",
            });
          }
          setSteps(out);
        }
      } catch (e: any) {
        console.warn("step lookup failed:", e?.message);
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Lookup by Document Number</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a document ID / number to fetch its on-chain status, every step in the workflow, and the full timeline.
        </p>
        <form onSubmit={e => { e.preventDefault(); search(); }} className="flex gap-2">
          <Input value={docId} onChange={e => setDocId(e.target.value)}
            placeholder="e.g. PROP-2026-0001 / claim-9982 / cert-abc" />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          </Button>
        </form>
      </div>

      {searched && (
        <>
          <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
            <h4 className="font-semibold text-sm">Status</h4>
            <div className="flex items-center gap-2 text-xs">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{docId}</span>
              <Badge variant={status && status !== "—" ? "default" : "outline"}>
                {status || "—"}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Workflow Steps ({steps.length})</h4>
              {instanceExists === false && <Badge variant="outline" className="text-[10px]">no instance</Badge>}
            </div>
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No step instance found for this document on StepManager.</p>
            ) : (
              <ol className="space-y-2">
                {steps.map(s => (
                  <li key={s.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-semibold">#{s.id} — {s.title}</span>
                      <Badge>{s.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {s.assignee !== "0x0000000000000000000000000000000000000000" &&
                        <div>assignee: <span className="font-mono">{s.assignee.slice(0, 10)}…</span></div>}
                      {s.actor !== "0x0000000000000000000000000000000000000000" &&
                        <div>actor: <span className="font-mono">{s.actor.slice(0, 10)}…</span></div>}
                      {s.verifier !== "0x0000000000000000000000000000000000000000" &&
                        <div>verifier: <span className="font-mono">{s.verifier.slice(0, 10)}…</span></div>}
                      {s.evidenceHash && (
                        <a href={`https://gateway.pinata.cloud/ipfs/${s.evidenceHash}`} target="_blank" rel="noreferrer"
                           className="text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> evidence (IPFS)
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <TimelineViewer entityType="document" entityId={docId.trim()} title="On-chain timeline for this document" />
        </>
      )}
    </div>
  );
}
