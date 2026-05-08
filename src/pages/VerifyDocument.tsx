import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Hash, FileText, Network, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function VerifyDocument() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase.from("verified_documents").select("*").eq("id", id).maybeSingle();
      setDoc(data);
      setLoading(false);
    })();
  }, [id]);

  return (
    <Layout>
      <section className="section-container">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Public Verification</span>
            </div>
            <h1 className="section-title mb-2">
              Document <span className="gradient-text">Verification</span>
            </h1>
          </div>

          <Card className="p-6 md:p-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !doc ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/40">
                <XCircle className="w-6 h-6 text-destructive" />
                <div>
                  <div className="font-semibold">Not Found</div>
                  <p className="text-sm text-muted-foreground">No document with this ID exists on the ledger.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/40">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">Authentic</span>
                      {doc.document_type && <Badge variant="outline">{doc.document_type}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      This document is recorded on the verification ledger.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card/50 border border-border">
                  <div className="text-sm font-semibold mb-1">{doc.document_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Issued {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-4 rounded-xl bg-card/50 border border-border">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Hash className="w-3 h-3" /> File Hash
                    </span>
                    <code className="text-xs break-all">{doc.file_hash}</code>
                  </div>
                  <div className="flex flex-col gap-1 p-4 rounded-xl bg-card/50 border border-border">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Content Hash
                    </span>
                    <code className="text-xs break-all">{doc.content_hash}</code>
                  </div>
                </div>

                {doc.extracted_data && Object.keys(doc.extracted_data).length > 0 && (
                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                    <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> Extracted Data
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(doc.extracted_data).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {doc.knowledge_graph?.edges?.length > 0 && (
                  <div className="p-4 rounded-xl bg-card/50 border border-border">
                    <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Network className="w-4 h-4 text-primary" /> Knowledge Graph
                    </div>
                    <div className="space-y-2">
                      {doc.knowledge_graph.edges.map((e: any, i: number) => (
                        <div key={i} className="text-sm flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{e.from}</Badge>
                          <span className="text-xs text-muted-foreground">→ {e.relation} →</span>
                          <Badge variant="secondary">{e.to}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </section>
    </Layout>
  );
}
