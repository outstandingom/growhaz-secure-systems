import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Package, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ApkBuild {
  id: string;
  app_name: string;
  website_url: string;
  package_name: string | null;
  platform: string | null;
  tier: string | null;
  status: string;
  error_message: string | null;
  download_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  created_at: string;
}

interface Props {
  userId: string;
}

export function MyApkBuilds({ userId }: Props) {
  const [builds, setBuilds] = useState<ApkBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBuilds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("apk_builds")
      .select("id, app_name, website_url, package_name, platform, tier, status, error_message, download_url, storage_path, file_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setBuilds((data as ApkBuild[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchBuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDownload = async (build: ApkBuild) => {
    setDownloadingId(build.id);
    try {
      // If storage_path not set, this is an old build — file was never in storage
      if (!build.storage_path && !build.download_url) {
        toast({
          title: "File Unavailable",
          description: "This build was created before storage was enabled. Please convert your website again to get a fresh APK.",
          variant: "destructive",
        });
        return;
      }

      let url = build.download_url;
      if (!url) {
        const path = build.storage_path!;
        const preferredExt = build.platform === "ios" ? "ipa" : "apk";
        const fileName = build.file_name || `${(build.app_name || "app").replace(/[^a-z0-9-_]+/gi, "_")}.${preferredExt}`;
        const { data, error } = await supabase.storage
          .from("app-builds")
          .createSignedUrl(path, 3600, { download: fileName });
        if (error) throw error;
        if (!data?.signedUrl) throw new Error("Could not generate download link");
        url = data.signedUrl;
      }

      // Verify file actually exists before opening (avoids 400 in new tab)
      const check = await fetch(url, { method: "HEAD" });
      if (!check.ok) {
        toast({
          title: "File Not Found",
          description: "The APK file was not saved to storage. Please convert your website again.",
          variant: "destructive",
        });
        return;
      }

      const a = document.createElement("a");
      a.href = url!;
      a.download = build.file_name || `${build.app_name || "app"}.apk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err.message || "Could not fetch APK from storage.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      completed: "bg-green-500/20 text-green-400 border-green-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      building: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (builds.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-card/50 border border-border">
        <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No APK builds yet</h3>
        <p className="text-muted-foreground">
          Convert a website to an app using the Website-to-App converter to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Converted Apps ({builds.length})</h2>
        <Button variant="outline" size="sm" onClick={fetchBuilds} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {builds.map((b) => (
          <div
            key={b.id}
            className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl bg-card/50 border border-border"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold truncate">{b.app_name}</h3>
                <Badge variant="outline" className={statusBadge(b.status)}>
                  {b.status}
                </Badge>
                {b.tier && <Badge variant="secondary">{b.tier}</Badge>}
                {b.platform && <Badge variant="outline">{b.platform}</Badge>}
              </div>
              <a
                href={b.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="truncate">{b.website_url}</span>
              </a>
              {b.package_name && (
                <p className="text-xs text-muted-foreground font-mono mt-1">{b.package_name}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(b.created_at), "PPp")}
              </p>
              {b.status === "failed" && b.error_message && (
                <p className="text-xs text-red-400 mt-2">{b.error_message}</p>
              )}
            </div>

            <div className="flex md:justify-end">
              {b.status === "completed" ? (
                <Button
                  onClick={() => handleDownload(b)}
                  disabled={downloadingId === b.id}
                  className="gap-2"
                >
                  {downloadingId === b.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download APK
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {b.status === "failed" ? "Build failed" : "In progress…"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
