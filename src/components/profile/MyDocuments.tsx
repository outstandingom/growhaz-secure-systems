import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText, QrCode, ExternalLink, Hash, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface Doc {
  id: string;
  document_name: string;
  document_type: string | null;
  file_hash: string;
  content_hash: string;
  status: string;
  created_at: string;
  storage_path: string;
  extracted_data: any;
}

export function MyDocuments({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDoc, setQrDoc] = useState<Doc | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("verified_documents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setDocs((data as Doc[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  const verifyUrl = (id: string) => `${window.location.origin}/verify/${id}`;

  const downloadDoc = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("verified-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No verified documents</h3>
        <p className="text-muted-foreground mb-6">
          Issue documents on the blockchain to see them here.
        </p>
        <Link to="/blockchain">
          <Button variant="hero">Verify Documents</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {docs.map((d) => (
          <div
            key={d.id}
            className="p-5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{d.document_name}</h3>
                    {d.document_type && <Badge variant="outline">{d.document_type}</Badge>}
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {d.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Hash className="w-3 h-3" />
                    <code className="truncate">{d.file_hash.slice(0, 24)}…</code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Issued {format(new Date(d.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setQrDoc(d)}>
                  <QrCode className="w-4 h-4 mr-1" /> QR
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadDoc(d.storage_path, d.document_name)}
                >
                  <ExternalLink className="w-4 h-4 mr-1" /> Open
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!qrDoc} onOpenChange={() => setQrDoc(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Verification QR</DialogTitle>
          {qrDoc && (
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white">
                <QRCodeSVG value={verifyUrl(qrDoc.id)} size={220} />
              </div>
              <p className="text-sm font-medium text-center">{qrDoc.document_name}</p>
              <a
                href={verifyUrl(qrDoc.id)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary break-all text-center"
              >
                {verifyUrl(qrDoc.id)}
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Anyone scanning this QR can verify the document publicly.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
