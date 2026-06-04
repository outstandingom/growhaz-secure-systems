/**
 * StepsPanel — full UI for contracts/StepManager.sol.
 *
 * Lets the user:
 *   - create an instance for any entity (document / process / claim ...)
 *   - dynamically add steps with assignee + description
 *   - start / complete (with evidence CID + note) / verify / reject
 *   - view all steps + their status
 *
 * Designed so the workflow is fully dynamic — steps can be added at runtime,
 * which is the whole point of having StepManager alongside ProcessManager.
 */
import { useState, useCallback, useEffect } from "react";
import { useChain, AMOY_EXPLORER } from "@/hooks/useChain";
import {
  STEP_MANAGER_ADDRESS,
  STEP_MANAGER_ABI,
  STEP_STATUS,
  stepInstanceKey,
  isStepManagerDeployed,
} from "@/lib/stepManagerContract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Workflow, Plus, Play, CheckCircle2, ShieldCheck, XCircle,
  RefreshCw, Hash, ExternalLink, User,
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground",
  InProgress: "bg-blue-500/20 text-blue-300",
  Completed: "bg-amber-500/20 text-amber-300",
  Verified: "bg-emerald-500/20 text-emerald-300",
  Rejected: "bg-red-500/20 text-red-300",
};

type StepView = {
  id: number;
  title: string;
  description: string;
  assignee: string;
  actor: string;
  verifier: string;
  evidenceHash: string;
  completionNote: string;
  verificationNote: string;
  status: string;
};

export function StepsPanel() {
  const { getContract } = useChain();
  const [busy, setBusy] = useState(false);

  // Instance form
  const [entityType, setEntityType] = useState("document");
  const [entityId, setEntityId] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [processType, setProcessType] = useState("default");

  // Step form
  const [stepTitle, setStepTitle] = useState("");
  const [stepDesc, setStepDesc] = useState("");
  const [stepAssignee, setStepAssignee] = useState("");

  // Action form
  const [actionStepId, setActionStepId] = useState<number | "">("");
  const [evidenceCid, setEvidenceCid] = useState("");
  const [actionNote, setActionNote] = useState("");

  // Listing
  const [steps, setSteps] = useState<StepView[]>([]);
  const [instanceExists, setInstanceExists] = useState<boolean | null>(null);

  const key = entityType && entityId ? stepInstanceKey(entityType.trim(), entityId.trim()) : "";

  const refresh = useCallback(async () => {
    if (!key) return;
    setBusy(true);
    try {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI);
      const inst = await c.instances(key);
      setInstanceExists(!!inst?.exists);
      if (!inst?.exists) { setSteps([]); return; }
      const count = Number(await c.getStepCount(key));
      const out: StepView[] = [];
      for (let i = 1; i <= count; i++) {
        const s = await c.getStep(key, i);
        out.push({
          id: Number(s.id),
          title: s.title,
          description: s.description,
          assignee: s.assignee,
          actor: s.actor,
          verifier: s.verifier,
          evidenceHash: s.evidenceHash,
          completionNote: s.completionNote,
          verificationNote: s.verificationNote,
          status: STEP_STATUS[Number(s.status)] || "Unknown",
        });
      }
      setSteps(out);
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Failed to load steps");
    } finally { setBusy(false); }
  }, [key, getContract]);

  useEffect(() => { setSteps([]); setInstanceExists(null); }, [key]);

  const wrap = async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    try {
      const tx = await fn();
      if (tx?.wait) { toast.message("Confirming on-chain…"); await tx.wait(); }
      toast.success(label);
      await refresh();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.reason || e?.message || "Failed");
    } finally { setBusy(false); }
  };

  const createInstance = () => {
    if (!entityId.trim()) return toast.error("Entity ID required");
    const org = organisation.trim();
    if (org && !/^0x[a-fA-F0-9]{40}$/.test(org)) return toast.error("Organisation must be a valid address or empty");
    return wrap("Instance created", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.createInstance(
        entityType.trim(),
        entityId.trim(),
        org || "0x0000000000000000000000000000000000000000",
        processType.trim() || "default",
      );
    });
  };

  const addStep = () => {
    if (!stepTitle.trim()) return toast.error("Step title required");
    const assignee = stepAssignee.trim();
    if (assignee && !/^0x[a-fA-F0-9]{40}$/.test(assignee)) return toast.error("Assignee must be valid 0x address (or empty for anyone)");
    return wrap("Step added", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.addStep(
        key,
        stepTitle.trim(),
        stepDesc.trim(),
        assignee || "0x0000000000000000000000000000000000000000",
      );
    });
  };

  const startStep = () => {
    if (!actionStepId) return toast.error("Step # required");
    return wrap("Step started", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.startStep(key, Number(actionStepId));
    });
  };

  const completeStep = () => {
    if (!actionStepId) return toast.error("Step # required");
    return wrap("Step completed", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.completeStep(key, Number(actionStepId), evidenceCid.trim(), actionNote.trim());
    });
  };

  const verifyStep = () => {
    if (!actionStepId) return toast.error("Step # required");
    return wrap("Step verified", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.verifyStep(key, Number(actionStepId), actionNote.trim());
    });
  };

  const rejectStep = () => {
    if (!actionStepId || !actionNote.trim()) return toast.error("Step # + reason required");
    return wrap("Step rejected", async () => {
      const c = await getContract(STEP_MANAGER_ADDRESS, STEP_MANAGER_ABI, { write: true });
      return c.rejectStep(key, Number(actionStepId), actionNote.trim());
    });
  };

  if (!isStepManagerDeployed()) {
    return (
      <div className="rounded-xl bg-card/50 border border-border p-4 text-sm text-muted-foreground">
        <Workflow className="w-4 h-4 inline mr-2 text-primary" />
        StepManager contract not configured. Run{" "}
        <code className="px-1 rounded bg-muted">npm run contracts:deploy:amoy</code>{" "}
        and paste <code className="px-1 rounded bg-muted">VITE_STEP_MANAGER_ADDRESS</code> into your <code>.env</code>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Instance ──────────────────────────────── */}
      <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Step Instance</h3>
          {instanceExists === true && <Badge variant="secondary" className="text-[10px]">exists on-chain</Badge>}
          {instanceExists === false && <Badge variant="outline" className="text-[10px]">not created yet</Badge>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Entity type</Label>
            <Input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="document" />
          </div>
          <div>
            <Label className="text-xs">Entity ID</Label>
            <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="doc-1234" />
          </div>
          <div>
            <Label className="text-xs">Organisation (optional)</Label>
            <Input value={organisation} onChange={e => setOrganisation(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
          </div>
          <div>
            <Label className="text-xs">Process type</Label>
            <Input value={processType} onChange={e => setProcessType(e.target.value)} placeholder="kyc / approval / …" />
          </div>
        </div>
        {key && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 break-all">
            <Hash className="w-3 h-3" /> instanceKey: <span className="font-mono">{key}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={createInstance} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            Create Instance
          </Button>
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy || !key}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Add step ──────────────────────────────── */}
      <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Add a Step</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Title</Label>
            <Input value={stepTitle} onChange={e => setStepTitle(e.target.value)} placeholder="Manager approval" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={stepDesc} onChange={e => setStepDesc(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Assignee address (blank = anyone)</Label>
            <Input value={stepAssignee} onChange={e => setStepAssignee(e.target.value)} placeholder="0x…" className="font-mono text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={addStep} disabled={busy || !key}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          Add Step
        </Button>
      </div>

      {/* ── Action a step ─────────────────────────── */}
      <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Play className="w-4 h-4 text-primary" /> Action a Step</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Step #</Label>
            <Input type="number" min={1} value={actionStepId}
              onChange={e => setActionStepId(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Evidence CID (Pinata/Filecoin)</Label>
            <Input value={evidenceCid} onChange={e => setEvidenceCid(e.target.value)} placeholder="bafy…" className="font-mono text-xs" />
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Note / reason</Label>
            <Textarea rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={startStep} disabled={busy || !key}><Play className="w-3 h-3 mr-1" /> Start</Button>
          <Button size="sm" variant="outline" onClick={completeStep} disabled={busy || !key}><CheckCircle2 className="w-3 h-3 mr-1" /> Complete</Button>
          <Button size="sm" variant="secondary" onClick={verifyStep} disabled={busy || !key}><ShieldCheck className="w-3 h-3 mr-1" /> Verify</Button>
          <Button size="sm" variant="destructive" onClick={rejectStep} disabled={busy || !key}><XCircle className="w-3 h-3 mr-1" /> Reject</Button>
        </div>
      </div>

      {/* ── Steps list ───────────────────────────── */}
      <div className="rounded-xl bg-card/50 border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Steps ({steps.length})</h3>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={busy || !key}>
            <RefreshCw className="w-3 h-3 mr-1" /> Reload
          </Button>
        </div>
        {steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">No steps yet. Create an instance and add steps above.</p>
        ) : (
          <ul className="space-y-2">
            {steps.map(s => (
              <li key={s.id} className="rounded-lg border border-border p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold">#{s.id} — {s.title}</span>
                  <Badge className={STATUS_COLOR[s.status] || ""}>{s.status}</Badge>
                </div>
                {s.description && <p className="text-muted-foreground">{s.description}</p>}
                <div className="grid sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                  {s.assignee !== "0x0000000000000000000000000000000000000000" && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> assignee: <span className="font-mono">{s.assignee.slice(0, 10)}…</span></span>
                  )}
                  {s.actor !== "0x0000000000000000000000000000000000000000" && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> actor: <span className="font-mono">{s.actor.slice(0, 10)}…</span></span>
                  )}
                  {s.verifier !== "0x0000000000000000000000000000000000000000" && (
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> verifier: <span className="font-mono">{s.verifier.slice(0, 10)}…</span></span>
                  )}
                  {s.evidenceHash && (
                    <a href={`https://gateway.pinata.cloud/ipfs/${s.evidenceHash}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> evidence
                    </a>
                  )}
                </div>
                {s.completionNote && <p className="text-[11px]"><span className="text-muted-foreground">note:</span> {s.completionNote}</p>}
                {s.verificationNote && <p className="text-[11px]"><span className="text-muted-foreground">verifier note:</span> {s.verificationNote}</p>}
              </li>
            ))}
          </ul>
        )}
        {STEP_MANAGER_ADDRESS && (
          <a href={`${AMOY_EXPLORER}/address/${STEP_MANAGER_ADDRESS}`} target="_blank" rel="noreferrer"
             className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> StepManager on Polygonscan
          </a>
        )}
      </div>
    </div>
  );
}
