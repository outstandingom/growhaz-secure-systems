/**
 * DemoProcessFlow — full create/list/manage UI for multi-step processes.
 * Backed by Supabase (demo_processes + demo_process_steps) so we can
 * demonstrate the on-chain Step Manager flow without paying gas on every click.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Play, Check, ShieldCheck, X, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type Process = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  entity_type: string;
  entity_ref: string | null;
  status: string;
  created_at: string;
};
type Step = {
  id: string;
  process_id: string;
  step_index: number;
  title: string;
  description: string | null;
  assignee_name: string | null;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function DemoProcessFlow() {
  const [userId, setUserId] = useState<string | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [steps, setSteps] = useState<Record<string, Step[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // new process form
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pEntityType, setPEntityType] = useState("document");
  const [pEntityRef, setPEntityRef] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: ps } = await supabase.from("demo_processes").select("*").order("created_at", { ascending: false }).limit(50);
    setProcesses((ps as Process[]) || []);
    const { data: ss } = await supabase.from("demo_process_steps").select("*").order("step_index");
    const grouped: Record<string, Step[]> = {};
    ((ss as Step[]) || []).forEach((s) => {
      (grouped[s.process_id] ||= []).push(s);
    });
    setSteps(grouped);
    setLoading(false);
  }

  async function createProcess() {
    if (!userId) return toast({ title: "Please sign in" });
    if (!pName.trim()) return toast({ title: "Process name required" });
    const { error } = await supabase.from("demo_processes").insert({
      owner_id: userId,
      name: pName.trim(),
      description: pDesc.trim() || null,
      entity_type: pEntityType,
      entity_ref: pEntityRef.trim() || null,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setPName(""); setPDesc(""); setPEntityRef("");
    toast({ title: "Process created" });
    load();
  }

  async function addStep(processId: string) {
    const title = prompt("Step title?");
    if (!title) return;
    const description = prompt("Step description (optional)?") || "";
    const assignee = prompt("Assignee name (optional)?") || "";
    const existing = steps[processId] || [];
    const nextIndex = existing.length;
    const { error } = await supabase.from("demo_process_steps").insert({
      process_id: processId,
      step_index: nextIndex,
      title,
      description,
      assignee_name: assignee,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    load();
  }

  async function updateStep(stepId: string, patch: Partial<Step>) {
    const { error } = await supabase.from("demo_process_steps").update(patch).eq("id", stepId);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    load();
  }

  async function startStep(s: Step) {
    await updateStep(s.id, { status: "in_progress" });
  }
  async function completeStep(s: Step) {
    const by = prompt("Completed by (name/role)?") || "system";
    await updateStep(s.id, { status: "completed", completed_by: by, completed_at: new Date().toISOString() });
  }
  async function verifyStep(s: Step) {
    const by = prompt("Verifier name?") || "verifier";
    const notes = prompt("Verification notes?") || "";
    await updateStep(s.id, { status: "verified", verified_by: by, verified_at: new Date().toISOString(), verification_notes: notes });
  }
  async function rejectStep(s: Step) {
    const notes = prompt("Reason for rejection?") || "";
    await updateStep(s.id, { status: "rejected", verification_notes: notes });
  }
  async function deleteProcess(id: string) {
    if (!confirm("Delete this process and all its steps?")) return;
    await supabase.from("demo_processes").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="site-glass">
        <CardHeader><CardTitle className="text-base">Create Process</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Process name (e.g. Land Title Transfer)" value={pName} onChange={(e) => setPName(e.target.value)} />
          <Textarea placeholder="Description" value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Entity type (document)" value={pEntityType} onChange={(e) => setPEntityType(e.target.value)} />
            <Input placeholder="Entity ref / doc id" value={pEntityRef} onChange={(e) => setPEntityRef(e.target.value)} />
          </div>
          <Button onClick={createProcess} className="w-full"><Plus className="w-4 h-4 mr-1" /> Create Process</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && processes.length === 0 && (
          <p className="text-xs text-muted-foreground">No processes yet. Create one above.</p>
        )}
        {processes.map((p) => {
          const isOpen = expanded[p.id];
          const list = steps[p.id] || [];
          const completed = list.filter((s) => s.status === "verified").length;
          return (
            <Card key={p.id} className="site-glass">
              <CardHeader className="cursor-pointer" onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}>
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <CardTitle className="text-base flex-1">{p.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{p.entity_type}</Badge>
                  <span className="text-xs text-muted-foreground">{completed}/{list.length}</span>
                  {p.owner_id === userId && (
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteProcess(p.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-2">
                  {list.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 bg-card/40 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{s.step_index + 1}</span>
                        <span className="font-medium text-sm flex-1">{s.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[s.status] || ""}`}>{s.status}</Badge>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      {s.assignee_name && <p className="text-[10px]">👤 {s.assignee_name}</p>}
                      {s.completed_by && <p className="text-[10px]">✓ completed by {s.completed_by}</p>}
                      {s.verified_by && <p className="text-[10px]">🛡️ verified by {s.verified_by}</p>}
                      {s.verification_notes && <p className="text-[10px] italic">"{s.verification_notes}"</p>}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {s.status === "pending" && <Button size="sm" variant="outline" onClick={() => startStep(s)}><Play className="w-3 h-3 mr-1" />Start</Button>}
                        {s.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => completeStep(s)}><Check className="w-3 h-3 mr-1" />Complete</Button>}
                        {s.status === "completed" && <>
                          <Button size="sm" variant="outline" onClick={() => verifyStep(s)}><ShieldCheck className="w-3 h-3 mr-1" />Verify</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectStep(s)}><X className="w-3 h-3 mr-1" />Reject</Button>
                        </>}
                      </div>
                    </div>
                  ))}
                  {p.owner_id === userId && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => addStep(p.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
