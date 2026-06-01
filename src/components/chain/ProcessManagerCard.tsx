/**
 * ProcessManagerCard — full UI for ProcessManager.sol:
 *   - create a template (uploads steps JSON to Pinata, then on-chain)
 *   - start an instance for a document
 *   - assign / approve / reject steps
 */
import { useState } from "react";
import { useChain, getInstanceId } from "@/hooks/useChain";
import { PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI } from "@/lib/contractsExtra";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Workflow, Play, UserPlus, CheckCircle2, XCircle, Archive } from "lucide-react";

function b64(s: string) {
  return btoa(unescape(encodeURIComponent(s)));
}

export function ProcessManagerCard({ archiveToFilecoin = true }: { archiveToFilecoin?: boolean }) {
  const { getContract } = useChain();
  const [busy, setBusy] = useState(false);

  // ── Template ─────────────────────────────────────
  const [tplId, setTplId] = useState("");
  const [tplSteps, setTplSteps] = useState(
    `[\n  { "name": "Document submitted", "role": "user" },\n  { "name": "KYC review", "role": "agent" },\n  { "name": "Manager approval", "role": "manager" }\n]`
  );

  const createTemplate = async () => {
    if (!tplId.trim()) return toast.error("Template ID required");
    let steps: any[];
    try { steps = JSON.parse(tplSteps); if (!Array.isArray(steps) || steps.length === 0) throw 0; }
    catch { return toast.error("Steps must be a non-empty JSON array"); }
    setBusy(true);
    try {
      // 1) Pin JSON to Pinata
      const pinPayload = { templateId: tplId.trim(), steps, createdAt: new Date().toISOString() };
      const { data: pin, error } = await supabase.functions.invoke("pinata-upload", {
        body: { fileBase64: b64(JSON.stringify(pinPayload, null, 2)), fileName: `process-${tplId}.json`, mimeType: "application/json" },
      });
      if (error) throw error;
      if (pin?.error) throw new Error(pin.error);

      // 2) Optional Filecoin archive
      if (archiveToFilecoin) {
        supabase.functions.invoke("filecoin-archive", {
          body: { fileBase64: b64(JSON.stringify(pinPayload)), fileName: `process-${tplId}.json`, mimeType: "application/json" },
        }).catch(() => { /* archive is best-effort */ });
      }

      // 3) On-chain
      const c = await getContract(PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI, { write: true });
      const tx = await c.createTemplate(tplId.trim(), pin.cid, steps.length);
      toast.message("Confirming on-chain…");
      await tx.wait();
      toast.success(`Template '${tplId}' created (${steps.length} steps)`);
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  // ── Instance lifecycle ───────────────────────────
  const [instTplId, setInstTplId] = useState("");
  const [instDocId, setInstDocId] = useState("");
  const [stepNum, setStepNum] = useState<number | "">(1);
  const [assignee, setAssignee] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const startInstance = async () => {
    if (!instTplId || !instDocId) return toast.error("Template ID + Document ID required");
    setBusy(true);
    try {
      const c = await getContract(PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI, { write: true });
      const tx = await c.startInstance(instTplId.trim(), instDocId.trim());
      await tx.wait();
      toast.success("Process instance started");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const assign = async () => {
    if (!instTplId || !instDocId || !stepNum || !/^0x[a-fA-F0-9]{40}$/.test(assignee))
      return toast.error("Fill template, doc, step, and valid assignee");
    setBusy(true);
    try {
      const c = await getContract(PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI, { write: true });
      const id = getInstanceId(instTplId.trim(), instDocId.trim());
      const tx = await c.assignStep(id, Number(stepNum), assignee);
      await tx.wait();
      toast.success(`Step ${stepNum} assigned`);
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!instTplId || !instDocId || !stepNum) return toast.error("Fill template, doc, step");
    setBusy(true);
    try {
      const c = await getContract(PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI, { write: true });
      const id = getInstanceId(instTplId.trim(), instDocId.trim());
      const tx = await c.approveStep(id, Number(stepNum));
      await tx.wait();
      toast.success(`Step ${stepNum} approved`);
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    if (!instTplId || !instDocId || !stepNum || !rejectReason.trim()) return toast.error("Reason required");
    setBusy(true);
    try {
      const c = await getContract(PROCESS_MANAGER_ADDRESS, PROCESS_MANAGER_ABI, { write: true });
      const id = getInstanceId(instTplId.trim(), instDocId.trim());
      const tx = await c.rejectStep(id, Number(stepNum), rejectReason.trim());
      await tx.wait();
      toast.success("Step rejected");
    } catch (e: any) { toast.error(e?.shortMessage || e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Workflow className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Process Manager</h3>
        {archiveToFilecoin && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Archive className="w-3 h-3" /> Filecoin archive
          </span>
        )}
      </div>

      <Tabs defaultValue="template">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="start">Start</TabsTrigger>
          <TabsTrigger value="step">Step Action</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-3 pt-3">
          <div>
            <Label className="text-xs">Template ID (unique)</Label>
            <Input value={tplId} onChange={e => setTplId(e.target.value)} placeholder="property-purchase-v1" />
          </div>
          <div>
            <Label className="text-xs">Steps (JSON array)</Label>
            <Textarea value={tplSteps} onChange={e => setTplSteps(e.target.value)} rows={6} className="font-mono text-xs" />
          </div>
          <Button size="sm" onClick={createTemplate} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Workflow className="w-3 h-3 mr-1" />}
            Create Template
          </Button>
        </TabsContent>

        <TabsContent value="start" className="space-y-3 pt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Template ID</Label>
              <Input value={instTplId} onChange={e => setInstTplId(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Document ID</Label>
              <Input value={instDocId} onChange={e => setInstDocId(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={startInstance} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            Start Instance
          </Button>
        </TabsContent>

        <TabsContent value="step" className="space-y-3 pt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Template ID</Label>
              <Input value={instTplId} onChange={e => setInstTplId(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Document ID</Label>
              <Input value={instDocId} onChange={e => setInstDocId(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Step #</Label>
              <Input type="number" min={1} value={stepNum} onChange={e => setStepNum(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Assignee (for Assign)</Label>
              <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Reject reason</Label>
              <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={assign} disabled={busy}><UserPlus className="w-3 h-3 mr-1" /> Assign</Button>
            <Button size="sm" variant="outline" onClick={approve} disabled={busy}><CheckCircle2 className="w-3 h-3 mr-1" /> Approve</Button>
            <Button size="sm" variant="destructive" onClick={reject} disabled={busy}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
