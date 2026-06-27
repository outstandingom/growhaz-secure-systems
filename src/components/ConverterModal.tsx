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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

type Step = "config" | "generating" | "done" | "error";

export function ConverterModal({ isOpen, onClose }: ConverterModalProps) {
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("config");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = (p: Partial<BuildConfig>) =>
    setConfig((c) => ({ ...c, ...p }));

  const isValid =
    config.websiteUrl.trim().length > 0 && config.appName.trim().length > 0;

  // Poll build status
  useEffect(() => {
    if (step === "generating" && buildId) {
      pollRef.current = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from("apk_builds")
            .select("status, error_message")
            .eq("id", buildId)
            .single();

          if (error) {
            console.error("Poll error:", error);
            return;
          }

          const build = data as { status: string; error_message: string | null } | null;
          if (build?.status === "completed") {
            setStep("done");
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (build?.status === "failed") {
            setStep("error");
            setErrorMsg(build.error_message || "Build failed");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [step, buildId]);

  const handleGenerate = async () => {
    if (!isValid) return;
    setStep("generating");
    setErrorMsg("");

    try {
      let websiteUrl = config.websiteUrl.trim();
      if (!websiteUrl.startsWith("http")) websiteUrl = "https://" + websiteUrl;

      // ✅ FIXED: Wrap everything in a "config" object
      const requestBody = {
        config: {
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
        }
      };

      console.log("📤 Sending request:", JSON.stringify(requestBody, null, 2));

      const { data, error } = await supabase.functions.invoke("trigger-build", {
        body: requestBody,
      });

      console.log("📥 Response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message);
      }
      
      if (data?.error) {
        console.error("Build error:", data.error);
        throw new Error(data.error);
      }
      
      if (!data?.build_id) {
        throw new Error("No build_id returned from edge function");
      }
      
      setBuildId(data.build_id);
      console.log("✅ Build started with ID:", data.build_id);
      
    } catch (err: any) {
      console.error("❌ Error:", err);
      setStep("error");
      setErrorMsg(err.message || "Failed to start build");
    }
  };

  const handleDownload = () => {
    if (!buildId) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    window.open(
      `https://${projectId}.supabase.co/functions/v1/download-apk?build_id=${buildId}`,
      "_blank"
    );
  };

  const handleReset = () => {
    setStep("config");
    setConfig({ ...DEFAULT_CONFIG });
    setBuildId(null);
    setErrorMsg("");
    setShowAdvanced(false);
  };

  const handleClose = () => {
    if (step === "generating") {
      if (!confirm("Build is in progress. Are you sure you want to close?")) {
        return;
      }
    }
    handleReset();
    onClose();
  };

  const outputLabel =
    config.platform === "ios" ? "IPA" : config.buildAab ? "AAB" : "APK";
  const platformLabel = config.platform === "ios" ? "iOS" : "Android";

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
            style={{
              width:
                step === "config"
                  ? "33%"
                  : step === "generating"
                  ? "66%"
                  : "100%",
            }}
          />
        </div>

        <div className="mt-4">
          {step === "config" && (
            <div className="space-y-6">
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

              <Button
                variant="hero"
                size="lg"
                className="w-full h-13 rounded-xl text-base gap-2"
                disabled={!isValid}
                onClick={handleGenerate}
              >
                <Sparkles className="w-4 h-4" />
                Generate {outputLabel}
              </Button>
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
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Your {outputLabel} is ready!</p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{config.appName}</span>{" "}
                  has been generated for {platformLabel}
                </p>
              </div>
              <div className="flex flex-col w-full gap-3">
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full h-13 rounded-xl gap-2"
                  onClick={handleDownload}
                >
                  <Download className="w-5 h-5" />
                  Download {outputLabel}
                </Button>
                <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                  Convert another website
                </Button>
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
