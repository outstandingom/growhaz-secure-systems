// src/components/ConverterModal.tsx

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Globe,
  Smartphone,
  Palette,
  Settings,
  Bell,
  Wifi,
  Shield,
  Gauge,
  Cloud,
  LogIn,
  Coins,
  Clock,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSpendCoins } from "@/hooks/useSpendCoins";
import { useBuildQueue } from "@/hooks/useBuildQueue";
import { useNavigate } from "react-router-dom";
import { TitleLadder } from "@/components/TitleLadder";

// Types
interface BuildConfig {
  websiteUrl: string;
  appName: string;
  packageName: string;
  logoPreview: string;
  splashColor: string;
  statusBarColor: string;
  platform: "android" | "ios";
  buildAab: boolean;
  enablePush: boolean;
  enableOffline: boolean;
  offlineMessage: string;
  enableAnalytics: boolean;
  enableCookies: boolean;
  enableAdmob: boolean;
  admobBannerId: string;
  admobInterstitialId: string;
  proxyEnabled: boolean;
  proxyType: "http" | "socks5";
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
}

const DEFAULT_CONFIG: BuildConfig = {
  websiteUrl: "",
  appName: "",
  packageName: "",
  logoPreview: "",
  splashColor: "#10B981",
  statusBarColor: "#000000",
  platform: "android",
  buildAab: false,
  enablePush: false,
  enableOffline: false,
  offlineMessage: "You are offline. Please check your connection.",
  enableAnalytics: false,
  enableCookies: true,
  enableAdmob: false,
  admobBannerId: "",
  admobInterstitialId: "",
  proxyEnabled: false,
  proxyType: "http",
  proxyHost: "",
  proxyPort: "",
  proxyUsername: "",
  proxyPassword: "",
};

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "config" | "queued" | "generating" | "done" | "error";

export function ConverterModal({ isOpen, onClose }: ConverterModalProps) {
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("config");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
<<<<<<< HEAD
  const [pollAttempts, setPollAttempts] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string>("");
=======
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const {
    joinQueue,
    queueEntry,
    queuePosition,
    queueStatus,
    activeCount,
    markCompleted,
    markFailed,
    resetQueue,
  } = useBuildQueue();

  const patch = (p: Partial<BuildConfig>) =>
    setConfig((c) => ({ ...c, ...p }));

  const isValid =
    config.websiteUrl.trim().length > 0 && config.appName.trim().length > 0;

  // Check auth on mount
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // When queue status changes to "building", trigger the actual build
  useEffect(() => {
    if (queueStatus === "building" && step === "queued" && queueEntry) {
      triggerActualBuild(queueEntry.build_id, queueEntry.id);
    }
  }, [queueStatus, step]);

  // Poll build status
  useEffect(() => {
    if (step === "generating" && buildId) {
      console.log(`📊 Starting polling for build: ${buildId}`);
      setPollAttempts(0);
      
      pollRef.current = setInterval(async () => {
        try {
          setPollAttempts(prev => prev + 1);
          
          const { data, error } = await supabase
            .from("apk_builds")
            .select("status, error_message, github_run_id")
            .eq("id", buildId)
            .single();

<<<<<<< HEAD
          if (error) {
            console.error("❌ Poll error:", error);
            return;
          }

          const build = data as { 
            status: string; 
            error_message: string | null;
            github_run_id: string | null;
          };

          console.log(`📊 Poll #${pollAttempts + 1} - Build status: ${build?.status}`);
          setBuildStatus(build?.status || "");

          if (build?.status === "completed") {
            console.log("✅ Build completed!");
            console.log("📥 GitHub Run ID:", build?.github_run_id);
            setStep("done");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (build?.status === "failed") {
            console.log("❌ Build failed:", build?.error_message);
            setStep("error");
            setErrorMsg(build?.error_message || "Build failed");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } else if (pollAttempts > 120) {
            console.log("⏰ Polling timeout - stopping after 10 minutes");
            setStep("error");
            setErrorMsg("Build is taking too long. Please check GitHub Actions for status.");
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch (err) {
          console.error("❌ Poll error:", err);
=======
        const build = data as { status: string; error_message: string | null } | null;
        if (build?.status === "completed") {
          setStep("done");
          if (queueEntry) markCompleted(queueEntry.id);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (build?.status === "failed") {
          setStep("error");
          setErrorMsg(build.error_message || "Build failed");
          if (queueEntry) markFailed(queueEntry.id);
          if (pollRef.current) clearInterval(pollRef.current);
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
        }
      }, 5000);
      
      return () => {
        if (pollRef.current) {
          console.log("🛑 Stopping polling");
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [step, buildId, pollAttempts]);

  const triggerActualBuild = async (bId: string, queueId: string) => {
    setStep("generating");
<<<<<<< HEAD
    setErrorMsg("");
    setPollAttempts(0);
    setBuildStatus("");

=======
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
    try {
      let websiteUrl = config.websiteUrl.trim();
      if (!websiteUrl.startsWith("http")) websiteUrl = "https://" + websiteUrl;

      const requestBody = {
        website_url: websiteUrl,
        app_name: config.appName.trim(),
        icon_url: config.logoPreview || null,
        package_name: config.packageName.trim() || null,
        splash_color: config.splashColor,
        status_bar_color: config.statusBarColor,
        enable_push: config.enablePush,
        enable_offline: config.enableOffline,
        offline_message: config.offlineMessage,
        enable_analytics: config.enableAnalytics,
        enable_cookies: config.enableCookies,
        enable_admob: config.enableAdmob,
        admob_banner_id: config.admobBannerId || null,
        admob_interstitial_id: config.admobInterstitialId || null,
        build_aab: config.buildAab,
        platform: config.platform,
        tier: "free",
        proxy_enabled: config.proxyEnabled,
        proxy_type: config.proxyType,
        proxy_host: config.proxyHost.trim(),
        proxy_port: config.proxyPort ? parseInt(config.proxyPort, 10) : null,
        proxy_username: config.proxyUsername,
        proxy_password: config.proxyPassword,
      };

      console.log("📤 Sending request to trigger-build function...");
      console.log("📤 Request body:", JSON.stringify(requestBody, null, 2));

      const { data, error } = await supabase.functions.invoke("trigger-build", {
<<<<<<< HEAD
        body: requestBody,
=======
        body: {
          website_url: websiteUrl,
          app_name: config.appName.trim(),
          icon_url: config.logoPreview || null,
          package_name: config.packageName.trim() || null,
          splash_color: config.splashColor,
          status_bar_color: config.statusBarColor,
          enable_push: config.enablePush,
          enable_offline: config.enableOffline,
          offline_message: config.offlineMessage,
          enable_analytics: config.enableAnalytics,
          enable_cookies: config.enableCookies,
          enable_admob: config.enableAdmob,
          admob_banner_id: config.admobBannerId || null,
          admob_interstitial_id: config.admobInterstitialId || null,
          build_aab: config.buildAab,
          platform: config.platform,
          proxy_enabled: config.proxyEnabled,
          proxy_type: config.proxyType,
          proxy_host: config.proxyHost.trim(),
          proxy_port: config.proxyPort ? parseInt(config.proxyPort, 10) : null,
          proxy_username: config.proxyUsername,
          proxy_password: config.proxyPassword,
          build_id: bId,
        },
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
      });

      console.log("📥 Response from trigger-build:", { data, error });

      if (error) {
        console.error("❌ Edge function error:", error);
        throw new Error(error.message);
      }
      
      if (data?.error) {
        console.error("❌ Build error:", data.error);
        throw new Error(data.error);
      }
      
      if (!data?.build_id) {
        throw new Error("No build_id returned from edge function");
      }
      
      setBuildId(data.build_id);
      console.log("✅ Build started with ID:", data.build_id);
      
    } catch (err: any) {
      console.error("❌ Error in handleGenerate:", err);
      setStep("error");
<<<<<<< HEAD
      setErrorMsg(err.message || "Failed to start build. Please try again.");
=======
      setErrorMsg(err.message || "Failed to start build");
      if (queueId) markFailed(queueId);
    }
  };

  const handleGenerate = async () => {
    if (!isValid) return;

    // 1. Auth check
    if (!isLoggedIn) {
      navigate("/auth");
      onClose();
      return;
    }

    // 2. Generate a build ID
    const newBuildId = crypto.randomUUID();
    setBuildId(newBuildId);

    // 3. Join queue
    const result = await joinQueue(newBuildId);
    if (!result) {
      setStep("error");
      setErrorMsg("Failed to join build queue");
      return;
    }

    if (result.canStart) {
      // Build can start immediately
      triggerActualBuild(newBuildId, result.entry.id);
    } else {
      // Must wait in queue
      setStep("queued");
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
    }
  };

  const handleDownload = async () => {
    if (!buildId) {
      console.error("❌ No build ID available");
      alert("No build ID available. Please try again.");
      return;
    }
    
    console.log("🚀 Starting download process...");
    console.log("📦 Build ID:", buildId);
    
    setIsDownloading(true);
    
    try {
      // Get the Supabase URL from the client configuration
      const supabaseUrl = supabase.supabaseUrl || '';
      console.log("🔗 Supabase URL:", supabaseUrl);
      
      // Extract project ID from Supabase URL
      const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      console.log("🔑 Project ID:", projectId);
      
      if (!projectId) {
        throw new Error("Could not determine Supabase project ID");
      }
      
      // Construct the download URL
      const downloadUrl = `https://${projectId}.supabase.co/functions/v1/download-apk?build_id=${buildId}`;
      console.log("📥 Download URL:", downloadUrl);
      
      // Make the fetch request
      console.log("📡 Sending request to download-apk function...");
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log("📊 Response received:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });
      
      if (!response.ok) {
        let errorMessage = `Download failed with status ${response.status}`;
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          console.error("❌ Error response:", errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } else {
          const errorText = await response.text();
          console.error("❌ Error text:", errorText);
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type') || '';
      console.log("📄 Content-Type:", contentType);
      
      if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        console.error("❌ Got JSON instead of file:", jsonData);
        throw new Error(jsonData.error || 'Server returned JSON instead of file');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${config.appName}.apk`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }
      
      console.log("📦 Expected filename:", filename);
      
      // Get the blob
      const blob = await response.blob();
      const contentLength = blob.size;
      
      console.log("📦 File details:", {
        size: contentLength,
        type: blob.type,
        filename: filename,
      });
      
      if (contentLength === 0) {
        throw new Error("Downloaded file is empty. The build may have failed.");
      }
      
      // Create download link
      console.log("💾 Creating download...");
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      
      console.log("🖱️ Triggering download...");
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        console.log("🧹 Cleanup complete");
      }, 100);
      
      console.log("✅ Download successful!");
      
    } catch (err: any) {
      console.error("❌ Download error:", err);
      console.error("❌ Error stack:", err.stack);
      setStep("error");
      setErrorMsg(err.message || "Failed to download. Please try again.");
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setStep("config");
    setConfig({ ...DEFAULT_CONFIG });
    setBuildId(null);
    setErrorMsg("");
    setShowAdvanced(false);
<<<<<<< HEAD
    setPollAttempts(0);
    setIsDownloading(false);
    setBuildStatus("");
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleClose = () => {
    if (step === "generating") {
      if (!confirm("Build is in progress. Are you sure you want to close? The build will continue in the background.")) {
=======
    resetQueue();
  };

  const handleClose = () => {
    if (step === "generating" || step === "queued") {
      if (!confirm("Build is in progress. Are you sure you want to close?")) {
>>>>>>> b6441e1 (feat: Add title leaderboard and build queue with coin gating)
        return;
      }
    }
    handleReset();
    onClose();
  };

  const outputLabel =
    config.platform === "ios" ? "IPA" : config.buildAab ? "AAB" : "APK";
  const platformLabel = config.platform === "ios" ? "iOS" : "Android";

  // Progress bar width
  const progressWidth =
    step === "config"
      ? "25%"
      : step === "queued"
      ? "40%"
      : step === "generating"
      ? "66%"
      : "100%";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Website to App Converter
          </DialogTitle>
          <DialogDescription>
            Turn any website into a native {platformLabel} app in minutes
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: progressWidth }}
          />
        </div>

        <div className="mt-4">
          {step === "config" && (
            <div className="space-y-6">
              {/* Auth / Coin Warning Banners */}
              {isLoggedIn === false && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <LogIn className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Login Required</p>
                    <p className="text-xs text-muted-foreground">
                      You need to log in or register before using this tool
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => { navigate("/auth"); onClose(); }}
                  >
                    Login
                  </Button>
                </div>
              )}

              {/* Active builds indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {activeCount}/20 builds running
                  {activeCount >= 20 && (
                    <span className="text-amber-500 ml-1">
                      — queue active, you may wait
                    </span>
                  )}
                </span>
              </div>

              {/* Core Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Website URL *
                  </Label>
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    value={config.websiteUrl}
                    onChange={(e) => patch({ websiteUrl: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appName" className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    App Name *
                  </Label>
                  <Input
                    id="appName"
                    placeholder="My Awesome App"
                    value={config.appName}
                    onChange={(e) => patch({ appName: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="packageName">Package Name</Label>
                    <Input
                      id="packageName"
                      placeholder="com.example.myapp"
                      value={config.packageName}
                      onChange={(e) => patch({ packageName: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <select
                      id="platform"
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={config.platform}
                      onChange={(e) =>
                        patch({ platform: e.target.value as "android" | "ios" })
                      }
                    >
                      <option value="android">Android</option>
                      <option value="ios">iOS</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="splashColor" className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Splash Color
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="splashColor"
                        type="color"
                        value={config.splashColor}
                        onChange={(e) => patch({ splashColor: e.target.value })}
                        className="w-12 h-10 p-1 rounded-xl"
                      />
                      <Input
                        type="text"
                        value={config.splashColor}
                        onChange={(e) => patch({ splashColor: e.target.value })}
                        className="flex-1 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="statusBarColor">Status Bar Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="statusBarColor"
                        type="color"
                        value={config.statusBarColor}
                        onChange={(e) => patch({ statusBarColor: e.target.value })}
                        className="w-12 h-10 p-1 rounded-xl"
                      />
                      <Input
                        type="text"
                        value={config.statusBarColor}
                        onChange={(e) => patch({ statusBarColor: e.target.value })}
                        className="flex-1 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoPreview">App Icon URL</Label>
                  <Input
                    id="logoPreview"
                    placeholder="https://example.com/icon.png"
                    value={config.logoPreview}
                    onChange={(e) => patch({ logoPreview: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Basic Features */}
              <div className="border-t border-border/40 pt-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.enablePush}
                      onChange={(e) => patch({ enablePush: e.target.checked })}
                      className="rounded"
                    />
                    <Bell className="w-3.5 h-3.5" />
                    Push Notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.enableOffline}
                      onChange={(e) => patch({ enableOffline: e.target.checked })}
                      className="rounded"
                    />
                    <Wifi className="w-3.5 h-3.5" />
                    Offline Support
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.enableCookies}
                      onChange={(e) => patch({ enableCookies: e.target.checked })}
                      className="rounded"
                    />
                    <Shield className="w-3.5 h-3.5" />
                    Cookies
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.buildAab}
                      onChange={(e) => patch({ buildAab: e.target.checked })}
                      className="rounded"
                    />
                    <Gauge className="w-3.5 h-3.5" />
                    AAB (Play Store)
                  </label>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="w-3.5 h-3.5 mr-1" />
                {showAdvanced ? "Hide" : "Show"} Advanced Settings
              </Button>

              {showAdvanced && (
                <div className="space-y-4 border border-border/40 rounded-xl p-4">
                  <h4 className="font-medium text-sm">Advanced Settings</h4>
                  
                  {/* AdMob */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={config.enableAdmob}
                        onChange={(e) => patch({ enableAdmob: e.target.checked })}
                        className="rounded"
                      />
                      <Cloud className="w-3.5 h-3.5" />
                      Enable AdMob
                    </label>
                    {config.enableAdmob && (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Banner Ad ID"
                          value={config.admobBannerId}
                          onChange={(e) => patch({ admobBannerId: e.target.value })}
                          className="rounded-xl text-xs"
                        />
                        <Input
                          placeholder="Interstitial Ad ID"
                          value={config.admobInterstitialId}
                          onChange={(e) =>
                            patch({ admobInterstitialId: e.target.value })
                          }
                          className="rounded-xl text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Proxy */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={config.proxyEnabled}
                        onChange={(e) => patch({ proxyEnabled: e.target.checked })}
                        className="rounded"
                      />
                      Enable Proxy
                    </label>
                    {config.proxyEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                          value={config.proxyType}
                          onChange={(e) =>
                            patch({ proxyType: e.target.value as "http" | "socks5" })
                          }
                        >
                          <option value="http">HTTP</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                        <Input
                          placeholder="Host"
                          value={config.proxyHost}
                          onChange={(e) => patch({ proxyHost: e.target.value })}
                          className="rounded-xl text-xs"
                        />
                        <Input
                          placeholder="Port"
                          value={config.proxyPort}
                          onChange={(e) => patch({ proxyPort: e.target.value })}
                          className="rounded-xl text-xs"
                        />
                        <Input
                          placeholder="Username (optional)"
                          value={config.proxyUsername}
                          onChange={(e) => patch({ proxyUsername: e.target.value })}
                          className="rounded-xl text-xs"
                        />
                        <Input
                          placeholder="Password (optional)"
                          type="password"
                          value={config.proxyPassword}
                          onChange={(e) => patch({ proxyPassword: e.target.value })}
                          className="rounded-xl text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base gap-2"
                disabled={
                  !isValid ||
                  !isLoggedIn
                }
                onClick={handleGenerate}
              >
                {!isLoggedIn ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Login to Generate
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate {outputLabel}
                    <span className="text-xs opacity-70 ml-1">
                      (Free)
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* QUEUED — waiting for slot */}
          {step === "queued" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-amber-500/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Waiting in Queue</p>
                <p className="text-sm text-muted-foreground">
                  Your build for{" "}
                  <span className="text-foreground font-medium">
                    {config.appName}
                  </span>{" "}
                  is in the queue
                </p>
                {queuePosition && (
                  <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border/40">
                    <p className="text-2xl font-bold text-primary">
                      #{queuePosition}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position in queue
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
                  <Users className="w-3.5 h-3.5" />
                  <span>{activeCount}/20 builds running</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your build will start automatically when a slot opens. Don't
                  close this page.
                </p>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="absolute -inset-3 rounded-3xl border border-primary/20 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Building your {outputLabel}...</p>
                <p className="text-sm text-muted-foreground">
                  Wrapping <span className="text-foreground font-medium">{config.appName}</span>{" "}
                  for {platformLabel}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 2–5 minutes. Don't close this page.
                </p>
                <p className="text-xs text-muted-foreground">
                  Build ID: <span className="font-mono text-foreground">{buildId}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-mono">{buildStatus || "Building..."}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Polling: {pollAttempts} attempts
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Your {outputLabel} is ready!</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{config.appName}</span>{" "}
                  has been generated for {platformLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  Build ID: <span className="font-mono">{buildId}</span>
                </p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full h-13 rounded-xl gap-2"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download {outputLabel}
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Convert another website
                </Button>
              </div>

              {/* Title Ladder Post-Build Upsell */}
              <div className="w-full pt-6 border-t border-border/40">
                <div className="text-center mb-4">
                  <h3 className="font-semibold flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Support Our Project!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    This converter is 100% free. If you found it useful, consider claiming a title to support us and show off your rank on the leaderboard!
                  </p>
                </div>
                <TitleLadder />
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Build failed</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                {buildId && (
                  <p className="text-xs text-muted-foreground">
                    Build ID: <span className="font-mono">{buildId}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Check the browser console for more details (F12)
                </p>
              </div>
              <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
