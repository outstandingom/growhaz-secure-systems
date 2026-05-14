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
  User,
  Calendar,
  Building2,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractAndHash } from "@/lib/documentExtractor";

type Mode = "issue" | "verify" | "bulk";

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
  fileHashMatch?: boolean;
  contentHashMatch?: boolean;
  uploadedPreview?: string;
  originalPreview?: string;
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
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string }>({ done: 0, total: 0, current: "" });
  const [bulkResults, setBulkResults] = useState<{ name: string; status: "ok" | "error"; message?: string; id?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const handleProcess = async () => {
    if (!file) return toast.error("Please select a document");
    if (!userId) return toast.error("Please sign in first");

    setLoading(true);
    setResult(null);
    try {
      // 1) Local extraction (no Vision API cost): OCR / PDF text / DOCX in browser.
      toast.message("Extracting text locally...");
      const [fileHash, base64, extracted] = await Promise.all([
        fileSha256(file),
        fileToBase64(file),
        extractAndHash(file),
      ]);

      // 2) Send the already-extracted text to the edge function for cheap
      // text-only structured analysis + KG (no image tokens).
      const { data, error } = await supabase.functions.invoke("verify-document", {
        body: { text: extracted.cleanedText, mimeType: file.type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Trust the locally-computed hash for determinism across client/server
      data.content_hash = extracted.contentHash;

      const aiResult: VerifyResult = { ...data, file_hash: fileHash };

      if (mode === "verify") {
        // 1) Try exact match on either hash. Content authenticity is only accepted
        // when the computed content hash exactly equals the stored content hash.
        let { data: matches } = await supabase
          .from("verified_documents")
          .select("*")
          .or(`file_hash.eq.${fileHash},content_hash.eq.${data.content_hash}`)
          .limit(1);

        // 2) Fallback lookup only helps show the likely original side-by-side.
        // It must never mark the document valid/authentic without exact content hash.
        if (!matches || matches.length === 0) {
          const ed = data.extracted_data || {};
          const certId = ed.certificate_id || ed.id;
          const name = ed.student_name || ed.name;
          const issueDate = ed.issue_date || ed.date;
          if (certId) {
            const { data: byId } = await supabase
              .from("verified_documents")
              .select("*")
              .filter("extracted_data->>certificate_id", "eq", certId)
              .limit(1);
            matches = byId || [];
          }
          if ((!matches || matches.length === 0) && name && issueDate) {
            const { data: byName } = await supabase
              .from("verified_documents")
              .select("*")
              .filter("extracted_data->>student_name", "eq", name)
              .filter("extracted_data->>issue_date", "eq", issueDate)
              .limit(1);
            matches = byName || [];
          }
        }

        aiResult.uploadedPreview = URL.createObjectURL(file);

        if (matches && matches.length > 0) {
          const m = matches[0];
          aiResult.matched = m;
          aiResult.fileHashMatch = m.file_hash === fileHash;
          aiResult.contentHashMatch = m.content_hash === data.content_hash;

          if (aiResult.contentHashMatch && aiResult.fileHashMatch) {
            aiResult.validation.status = "authentic";
            aiResult.validation.explanation = "Content hash matches 100% and file hash matches — this document is byte-for-byte identical to the original on the ledger.";
          } else if (aiResult.contentHashMatch) {
            aiResult.validation.status = "valid";
            aiResult.validation.explanation = "Content hash matches 100% — the information is authentic. The file hash differs, so the file was likely compressed, resized, or converted.";
          } else {
            aiResult.validation.status = "tampered";
            aiResult.validation.explanation = "Content hash does not match exactly. This document cannot be marked valid or authentic, even if some extracted fields look similar.";
          }

          const { data: signed } = await supabase.storage
            .from("verified-documents")
            .createSignedUrl(m.storage_path, 300);
          aiResult.originalPreview = signed?.signedUrl;
        } else {
          aiResult.fileHashMatch = false;
          aiResult.contentHashMatch = false;
          aiResult.validation.status = "tampered";
          aiResult.validation.explanation = "No matching record found in the verification ledger.";
        }

        // Record verification history (best-effort)
        await supabase.from("verification_logs").insert({
          user_id: userId,
          document_name: file.name,
          file_hash: fileHash,
          content_hash: data.content_hash,
          file_hash_match: aiResult.fileHashMatch,
          content_hash_match: aiResult.contentHashMatch,
          status: aiResult.validation.status,
          matched_document_id: aiResult.matched?.id ?? null,
          extracted_data: data.extracted_data || {},
        });
      } else {
        // Issue mode: Supabase storage + IPFS (Pinata) + on-chain register
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("verified-documents")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        // 1) Pin original file to IPFS
        toast.message("Pinning to IPFS...");
        const { data: pin, error: pinErr } = await supabase.functions.invoke("pinata-upload", {
          body: { fileBase64: base64, fileName: file.name, mimeType: file.type },
        });
        if (pinErr) throw pinErr;
        if (pin?.error) throw new Error(pin.error);

        // 2) Register dual hash + CID on smart contract
        toast.message("Registering on blockchain...");
        const { data: chain, error: chainErr } = await supabase.functions.invoke("blockchain-register", {
          body: {
            action: "register",
            fileHash,
            contentHash: data.content_hash,
            ipfsCid: pin.cid,
          },
        });
        if (chainErr) throw chainErr;
        if (chain?.error) throw new Error(chain.error);

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
          ipfs_cid: pin.cid,
          ipfs_url: pin.url,
          blockchain_tx: chain.txHash,
          chain_tx_hash: chain.txHash,
          chain_block_number: chain.blockNumber,
          chain_issuer_address: chain.issuer,
          chain_contract_address: chain.contractAddress,
        });
        if (insErr) throw insErr;
        toast.success("Issued: pinned to IPFS and recorded on-chain");
      }

      setResult(aiResult);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Processing failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkProcess = async () => {
    if (!userId) return toast.error("Please sign in first");
    if (bulkFiles.length === 0) return toast.error("Please select documents");

    setLoading(true);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: bulkFiles.length, current: "" });

    const results: typeof bulkResults = [];
    for (let i = 0; i < bulkFiles.length; i++) {
      const f = bulkFiles[i];
      setBulkProgress({ done: i, total: bulkFiles.length, current: f.name });
      try {
        const [fileHash, base64] = await Promise.all([fileSha256(f), fileToBase64(f)]);
        const { data, error } = await supabase.functions.invoke("verify-document", {
          body: { imageBase64: base64, mimeType: f.type },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const path = `${userId}/${Date.now()}-${i}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("verified-documents")
          .upload(path, f, { upsert: false });
        if (upErr) throw upErr;

        const { data: pin, error: pinErr } = await supabase.functions.invoke("pinata-upload", {
          body: { fileBase64: base64, fileName: f.name, mimeType: f.type },
        });
        if (pinErr) throw pinErr;
        if (pin?.error) throw new Error(pin.error);

        const { data: chain, error: chainErr } = await supabase.functions.invoke("blockchain-register", {
          body: { action: "register", fileHash, contentHash: data.content_hash, ipfsCid: pin.cid },
        });
        if (chainErr) throw chainErr;
        if (chain?.error) throw new Error(chain.error);

        const { data: inserted, error: insErr } = await supabase
          .from("verified_documents")
          .insert({
            user_id: userId,
            document_name: f.name,
            document_type: data.document_type,
            file_hash: fileHash,
            content_hash: data.content_hash,
            storage_path: path,
            extracted_data: data.extracted_data,
            knowledge_graph: data.knowledge_graph,
            ai_validation: data.validation,
            status: data.validation?.status || "authentic",
            ipfs_cid: pin.cid,
            ipfs_url: pin.url,
            blockchain_tx: chain.txHash,
            chain_tx_hash: chain.txHash,
            chain_block_number: chain.blockNumber,
            chain_issuer_address: chain.issuer,
            chain_contract_address: chain.contractAddress,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        results.push({ name: f.name, status: "ok", id: inserted?.id });
      } catch (e: any) {
        console.error(e);
        results.push({ name: f.name, status: "error", message: e.message || "Failed" });
      }
      setBulkResults([...results]);
    }
    setBulkProgress({ done: bulkFiles.length, total: bulkFiles.length, current: "" });
    setLoading(false);
    toast.success(`Bulk complete: ${results.filter(r => r.status === "ok").length}/${bulkFiles.length} issued`);
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">AI + Blockchain</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6">
            Intelligent <span className="gradient-text">Document Verification</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            Decentralized authentication that combines blockchain trust, AI reasoning, and a knowledge
            graph to verify the meaning — not just the bytes — of any credential.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {features.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-card/50 border border-border"
              >
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verify / Issue Tool */}
      <section className="section-container pt-0">
        <Card className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            <button
              onClick={() => { setMode("issue"); setResult(null); }}
              className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border transition ${
                mode === "issue" ? "bg-primary/10 border-primary text-primary" : "bg-card/50 border-border hover:border-primary/40"
              }`}
            >
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs sm:text-sm font-medium">Issue</span>
            </button>
            <button
              onClick={() => { setMode("bulk"); setResult(null); }}
              className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border transition ${
                mode === "bulk" ? "bg-primary/10 border-primary text-primary" : "bg-card/50 border-border hover:border-primary/40"
              }`}
            >
              <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs sm:text-sm font-medium">Bulk</span>
            </button>
            <button
              onClick={() => { setMode("verify"); setResult(null); }}
              className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border transition ${
                mode === "verify" ? "bg-primary/10 border-primary text-primary" : "bg-card/50 border-border hover:border-primary/40"
              }`}
            >
              <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs sm:text-sm font-medium">Verify</span>
            </button>
          </div>

          {mode !== "bulk" ? (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) setFile(dropped);
                }}
                className="flex flex-col items-center gap-2 sm:gap-3 p-5 sm:p-8 rounded-xl bg-card/50 border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition mb-4 text-center"
              >
                <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                <span className="text-sm font-medium break-all px-2">{file ? file.name : "Drag & drop or tap to upload PDF / JPG / PNG"}</span>
                <span className="text-xs text-muted-foreground">Image-based extraction works best</span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button onClick={handleProcess} disabled={loading || !file} variant="hero" size="lg" className="w-full">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Processing with AI...</>
                ) : mode === "issue" ? "Issue & Record on Ledger" : "Verify Document"}
              </Button>
            </>
          ) : (
            <>
              <div
                onClick={() => bulkInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = Array.from(e.dataTransfer.files || []);
                  if (dropped.length > 0) setBulkFiles(dropped);
                }}
                className="flex flex-col items-center gap-2 sm:gap-3 p-5 sm:p-8 rounded-xl bg-card/50 border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition mb-4 text-center"
              >
                <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                <span className="text-sm font-medium">
                  {bulkFiles.length > 0 ? `${bulkFiles.length} files selected` : "Drag & drop or tap to upload multiple documents"}
                </span>
                <span className="text-xs text-muted-foreground px-2">
                  For schools, colleges, enterprises — upload up to 300 files at once
                </span>
                <Input
                  ref={bulkInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
                />
              </div>

              <Button onClick={handleBulkProcess} disabled={loading || bulkFiles.length === 0} variant="hero" size="lg" className="w-full">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Processing {bulkProgress.done}/{bulkProgress.total}...</>
                ) : (
                  `Issue ${bulkFiles.length || ""} Documents on Ledger`
                )}
              </Button>

              {bulkProgress.total > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded-full bg-card/50 border border-border overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                  {bulkProgress.current && (
                    <p className="text-xs text-muted-foreground truncate">Current: {bulkProgress.current}</p>
                  )}
                </div>
              )}

              {bulkResults.length > 0 && (
                <div className="mt-6 max-h-72 overflow-y-auto space-y-2">
                  {bulkResults.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                        r.status === "ok"
                          ? "bg-primary/5 border-primary/30"
                          : "bg-destructive/10 border-destructive/40"
                      }`}
                    >
                      {r.status === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="truncate flex-1">{r.name}</span>
                      {r.message && <span className="text-xs text-muted-foreground">{r.message}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

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

              {/* Key info highlights — owner, dates, etc. */}
              {result.extracted_data && Object.keys(result.extracted_data).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: "student_name", label: "Owner", icon: User, fallback: result.extracted_data.name },
                    { key: "issue_date", label: "Issue Date", icon: Calendar, fallback: result.extracted_data.date },
                    { key: "institution", label: "Issuer", icon: Building2 },
                    { key: "degree", label: "Title", icon: Award, fallback: result.extracted_data.course },
                  ].map(({ key, label, icon: Icon, fallback }) => {
                    const value = result.extracted_data[key] || fallback;
                    if (!value) return null;
                    return (
                      <div key={key} className="flex flex-col gap-1 p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <span className="text-[10px] uppercase tracking-wide text-primary flex items-center gap-1">
                          <Icon className="w-3 h-3" /> {label}
                        </span>
                        <span className="text-sm font-semibold break-words">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dual hash comparison — visual side-by-side with match indicators */}
              {mode === "verify" && result.matched ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0">
                    {/* Uploaded */}
                    <div className="p-4 bg-card/50">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">UPLOADED FILE</div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" /> File Hash
                          </div>
                          <code className="text-[10px] break-all">{result.file_hash}</code>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" /> Content Hash
                          </div>
                          <code className="text-[10px] break-all">{result.content_hash}</code>
                        </div>
                      </div>
                    </div>

                    {/* Match indicators */}
                    <div className="flex md:flex-col items-center justify-around gap-4 p-4 bg-primary/5 border-y md:border-y-0 md:border-x border-border">
                      <div className="flex flex-col items-center gap-1">
                        {result.fileHashMatch ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-yellow-500" />
                        )}
                        <span className="text-[10px] text-center">File {result.fileHashMatch ? "100%" : "differs"}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        {result.contentHashMatch ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                        <span className="text-[10px] text-center">Content {result.contentHashMatch ? "100%" : "differs"}</span>
                      </div>
                    </div>

                    {/* Original */}
                    <div className="p-4 bg-card/50">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">ORIGINAL ON LEDGER</div>
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" /> File Hash
                          </div>
                          <code className="text-[10px] break-all">{result.matched.file_hash}</code>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" /> Content Hash
                          </div>
                          <code className="text-[10px] break-all">{result.matched.content_hash}</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-side image preview */}
                  {(result.uploadedPreview || result.originalPreview) && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-background border-t border-border">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-center text-muted-foreground">Uploaded</span>
                        {result.uploadedPreview && (
                          <img src={result.uploadedPreview} alt="Uploaded document" className="w-full h-48 object-contain rounded-lg bg-card/50 border border-border" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-center text-muted-foreground">Original</span>
                        {result.originalPreview ? (
                          <img src={result.originalPreview} alt="Original document" className="w-full h-48 object-contain rounded-lg bg-card/50 border border-border" />
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center rounded-lg bg-card/50 border border-border text-xs text-muted-foreground">
                            Preview unavailable
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Hash className="w-3 h-3" /> File Hash
                    </span>
                    <code className="text-xs break-all">{result.file_hash}</code>
                    <span className="text-[10px] text-muted-foreground">Detects any byte-level change (resize, re-save, format).</span>
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Content Hash
                    </span>
                    <code className="text-xs break-all">{result.content_hash}</code>
                    <span className="text-[10px] text-muted-foreground">Hash of extracted information — survives format changes.</span>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-card/50 border border-border">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Full Extracted Data
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
