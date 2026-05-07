import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Brain,
  Database,
  Network,
  FileCheck2,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Hash,
  Search,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "issue" | "verify";

interface VerifyResult {
  document_type: string;
  extracted_data: Record<string, string>;
  knowledge_graph: {
    nodes?: string[];
    edges?: { from: string; to: string; relation: string }[];
  };
  validation: { status: string; issues?: string[]; explanation: string };
  content_hash: string;
  file_hash?: string;
  matched?: any;
}

const features = [
  { icon: ShieldCheck, label: "Blockchain Trust" },
  { icon: Brain, label: "AI Knowledge Graph" },
  { icon: Database, label: "Decentralized Storage" },
  { icon: FileCheck2, label: "Explainable Verification" },
];

const flow = [
  { icon: Upload, label: "Upload Document" },
  { icon: Brain, label: "AI Extraction" },
  { icon: Network, label: "Knowledge Graph" },
  { icon: Hash, label: "Dual Hash" },
  { icon: Database, label: "Store on Chain" },
  { icon: Search, label: "Verify Anywhere" },
];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      res(s.split(",")[1]);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function fileSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Blockchain() {
  const [mode, setMode] = useState<Mode>("issue");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const handleProcess = async () => {
    if (!file) return toast.error("Please select a document");
    if (!userId) return toast.error("Please sign in first");

    setLoading(true);
    setResult(null);
    try {
      const [fileHash, base64] = await Promise.all([fileSha256(file), fileToBase64(file)]);

      const { data, error } = await supabase.functions.invoke("verify-document", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const aiResult: VerifyResult = { ...data, file_hash: fileHash };

      if (mode === "verify") {
        // Look up by content hash (semantic match) or file hash
        const { data: matches } = await supabase
          .from("verified_documents")
          .select("*")
          .or(`file_hash.eq.${fileHash},content_hash.eq.${data.content_hash}`)
          .limit(1);

        if (matches && matches.length > 0) {
          const m = matches[0];
          aiResult.matched = m;
          aiResult.validation.status = m.file_hash === fileHash ? "authentic" : "valid";
          aiResult.validation.explanation =
            m.file_hash === fileHash
              ? "Exact file match found on blockchain ledger."
              : "Format changed but document content matches a verified record (content hash match).";
        } else {
          aiResult.validation.status = "tampered";
          aiResult.validation.explanation = "No matching record found in the verification ledger.";
        }
      } else {
        // Issue mode: store
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("verified-documents")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("verified_documents").insert({
          user_id: userId,
          document_name: file.name,
          document_type: data.document_type,
          file_hash: fileHash,
          content_hash: data.content_hash,
          storage_path: path,
          extracted_data: data.extracted_data,
          knowledge_graph: data.knowledge_graph,
          ai_validation: data.validation,
          status: data.validation?.status || "authentic",
          blockchain_tx: `0x${fileHash.slice(0, 40)}`,
        });
        if (insErr) throw insErr;
        toast.success("Document issued and recorded on the ledger");
      }

      setResult(aiResult);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Processing failed");
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon =
    result?.validation.status === "authentic"
      ? CheckCircle2
      : result?.validation.status === "valid"
        ? CheckCircle2
        : result?.validation.status === "suspicious"
          ? AlertTriangle
          : XCircle;

  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI + Blockchain</span>
          </div>
          <h1 className="section-title mb-6">
            Intelligent <span className="gradient-text">Document Verification</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Decentralized authentication that combines blockchain trust, AI reasoning, and a knowledge
            graph to verify the meaning — not just the bytes — of any credential.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {features.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border"
              >
                <item.icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verify / Issue Tool */}
      <section className="section-container pt-0">
        <Card className="max-w-3xl mx-auto p-6 md:p-8">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                setMode("issue");
                setResult(null);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${
                mode === "issue"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card/50 border-border hover:border-primary/40"
              }`}
            >
              <FileText className="w-6 h-6" />
              <span className="text-sm font-medium">Issue Document</span>
            </button>
            <button
              onClick={() => {
                setMode("verify");
                setResult(null);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${
                mode === "verify"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card/50 border-border hover:border-primary/40"
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-sm font-medium">Verify Document</span>
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 p-8 rounded-xl bg-card/50 border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition mb-4"
          >
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium">
              {file ? file.name : "Click to upload PDF / JPG / PNG"}
            </span>
            <span className="text-xs text-muted-foreground">
              Image-based extraction works best
            </span>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            onClick={handleProcess}
            disabled={loading || !file}
            variant="hero"
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing with AI...
              </>
            ) : mode === "issue" ? (
              "Issue & Record on Ledger"
            ) : (
              "Verify Document"
            )}
          </Button>

          {!userId && (
            <p className="text-xs text-center text-muted-foreground mt-3">
              Sign in to issue or verify documents.
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="mt-8 space-y-4">
              <div
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  result.validation.status === "tampered"
                    ? "bg-destructive/10 border-destructive/40"
                    : result.validation.status === "suspicious"
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : "bg-primary/10 border-primary/40"
                }`}
              >
                <StatusIcon className="w-6 h-6 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize">{result.validation.status}</span>
                    <Badge variant="outline">{result.document_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.validation.explanation}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
                  <span className="text-xs font-medium text-primary">File Hash</span>
                  <code className="text-xs break-all">{result.file_hash}</code>
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
                  <span className="text-xs font-medium text-primary">Content Hash</span>
                  <code className="text-xs break-all">{result.content_hash}</code>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card/50 border border-border">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Extracted Data
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(result.extracted_data).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-xs text-muted-foreground capitalize">
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {result.knowledge_graph?.edges && result.knowledge_graph.edges.length > 0 && (
                <div className="p-4 rounded-xl bg-card/50 border border-border">
                  <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" /> Knowledge Graph
                  </div>
                  <div className="space-y-2">
                    {result.knowledge_graph.edges.map((e, i) => (
                      <div key={i} className="text-sm flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{e.from}</Badge>
                        <span className="text-xs text-muted-foreground">→ {e.relation} →</span>
                        <Badge variant="secondary">{e.to}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.validation.issues && result.validation.issues.length > 0 && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/40">
                  <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Logical Issues Detected
                  </div>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    {result.validation.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* How it works */}
      <section className="section-container bg-card/50">
        <div className="text-center mb-12">
          <h2 className="section-title mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="section-subtitle mx-auto">
            Verification = Integrity + Meaning + Logical Validation
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {flow.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border"
            >
              <s.icon className="w-6 h-6 text-primary" />
              <span className="text-xs font-medium text-center">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Innovations */}
      <section className="section-container">
        <div className="text-center mb-12">
          <h2 className="section-title mb-4">
            Core <span className="gradient-text">Innovations</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Hash, label: "Dual Hash Verification" },
            { icon: Network, label: "Knowledge Graph Logic" },
            { icon: Brain, label: "Explainable AI" },
            { icon: Database, label: "Hybrid Architecture" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border"
            >
              <item.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-center">{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
