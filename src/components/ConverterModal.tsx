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
  Lock,
  Crown,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { useBuildQueue } from "@/hooks/useBuildQueue";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// ---------- Tier definitions ----------
type TierId = "basic" | "logo" | "advanced" | "pro";

interface TierDef {
  id: TierId;
  name: string;
  price: number; // in ₹ / coins (1 coin = ₹1)
  tagline: string;
  icon: React.ElementType;
  features: string[];
  unlocks: {
    customIcon: boolean;
    customColors: boolean;
    push: boolean;
    offline: boolean;
    splashScreen: boolean;
    aab: boolean;
    ios: boolean;
    admob: boolean;
    proxy: boolean;
  };
}

const GROWHAZ_ICON_URL = "https://growhaz-secure-systems.vercel.app/favicon.png";

const TIERS: TierDef[] = [
  {
    id: "basic",
    name: "Basic APK",
    price: 49,
    tagline: "Quick APK with GrowHaz branding",
    icon: Smartphone,
    features: [
      "Android APK",
      "GrowHaz default logo & splash",
      "Just enter your website URL",
    ],
    unlocks: {
      customIcon: false,
      customColors: false,
      push: false,
      offline: false,
      splashScreen: false,
      aab: false,
      ios: false,
      admob: false,
      proxy: false,
    },
  },
  {
    id: "logo",
    name: "Custom Branding",
    price: 99,
    tagline: "Your own logo & colors",
    icon: Palette,
    features: [
      "Everything in Basic",
      "Custom app icon URL",
      "Custom splash & status bar colors",
    ],
    unlocks: {
      customIcon: true,
      customColors: true,
      push: false,
      offline: false,
      splashScreen: false,
      aab: false,
      ios: false,
      admob: false,
      proxy: false,
    },
  },
  {
    id: "advanced",
    name: "Advanced",
    price: 499,
    tagline: "Splash screen + smart features",
    icon: Zap,
    features: [
      "Everything in Custom Branding",
      "Custom splash screen",
      "Push notifications",
      "Offline support",
    ],
    unlocks: {
      customIcon: true,
      customColors: true,
      push: true,
      offline: true,
      splashScreen: true,
      aab: false,
      ios: false,
      admob: false,
      proxy: false,
    },
  },
  {
    id: "pro",
    name: "Pro (Everything)",
    price: 999,
    tagline: "All features unlocked",
    icon: Crown,
    features: [
      "Everything in Advanced",
      "iOS build (IPA)",
      "AAB for Play Store",
      "AdMob monetization",
      "Custom proxy support",
    ],
    unlocks: {
      customIcon: true,
      customColors: true,
      push: true,
      offline: true,
      splashScreen: true,
      aab: true,
      ios: true,
      admob: true,
      proxy: true,
    },
  },
];

const getTier = (id: TierId): TierDef => TIERS.find((t) => t.id === id)!;

// ---------- Types ----------
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

type Step = "tier" | "config" | "paying" | "queued" | "generating" | "done" | "error";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function ConverterModal({ isOpen, onClose }: ConverterModalProps) {
  const [selectedTier, setSelectedTier] = useState<TierId>("basic");
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("tier");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pollAttempts, setPollAttempts] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, fetchBalance, fetchTransactions } = useWallet();

  const tier = getTier(selectedTier);

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

  // Load Razorpay script
  useEffect(() => {
    if (!isOpen) return;
    if (window.Razorpay) {
      setRazorpayLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => {
      // don't remove; other components may use it
    };
  }, [isOpen]);

  // Auto-generate package name
  useEffect(() => {
    if (!config.packageName && config.appName.trim()) {
      const sanitized = config.appName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      patch({ packageName: `com.app.${sanitized}` });
    }
  }, [config.appName, config.packageName]);

  // Auth
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Trigger build once queue lets us in
  useEffect(() => {
    if (queueStatus === "building" && step === "queued" && queueEntry) {
      triggerActualBuild(queueEntry.build_id, queueEntry.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueStatus, step]);

  // Poll build status
  useEffect(() => {
    if (step === "generating" && buildId) {
      setPollAttempts(0);
      pollRef.current = setInterval(async () => {
        try {
          setPollAttempts((p) => p + 1);
          const { data } = await supabase
            .from("apk_builds")
            .select("status, error_message, github_run_id")
            .eq("id", buildId)
            .single();
          const build = data as any;
          setBuildStatus(build?.status || "");
          if (build?.status === "completed") {
            setStep("done");
            if (queueEntry) markCompleted(queueEntry.id);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (build?.status === "failed") {
            setStep("error");
            setErrorMsg(build?.error_message || "Build failed");
            if (queueEntry) markFailed(queueEntry.id);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (pollAttempts > 120) {
            setStep("error");
            setErrorMsg("Build is taking too long. Please check GitHub Actions for status.");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (err) {
          console.error(err);
        }
      }, 5000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buildId]);

  // ---------- Build trigger ----------
  const triggerActualBuild = async (bId: string, queueId: string) => {
    setStep("generating");
    setErrorMsg("");
    setPollAttempts(0);
    setBuildStatus("");

    try {
      let websiteUrl = config.websiteUrl.trim();
      if (!websiteUrl.startsWith("http")) websiteUrl = "https://" + websiteUrl;

      const u = tier.unlocks;

      // Force GrowHaz branding / defaults for lower tiers
      const iconUrl = u.customIcon && config.logoPreview
        ? config.logoPreview
        : GROWHAZ_ICON_URL;
      const splashColor = u.customColors ? config.splashColor : "#10B981";
      const statusBarColor = u.customColors ? config.statusBarColor : "#000000";
      const platform = u.ios ? config.platform : "android";
      const buildAab = u.aab ? config.buildAab : false;

      const requestBody = {
        website_url: websiteUrl,
        app_name: config.appName.trim(),
        icon_url: iconUrl,
        package_name: config.packageName.trim() || null,
        splash_color: splashColor,
        status_bar_color: statusBarColor,
        enable_push: u.push ? config.enablePush : false,
        enable_offline: u.offline ? config.enableOffline : false,
        offline_message: config.offlineMessage,
        enable_analytics: false,
        enable_cookies: config.enableCookies,
        enable_admob: u.admob ? config.enableAdmob : false,
        admob_banner_id: u.admob ? (config.admobBannerId || null) : null,
        admob_interstitial_id: u.admob ? (config.admobInterstitialId || null) : null,
        build_aab: buildAab,
        platform,
        tier: tier.id,
        proxy_enabled: u.proxy ? config.proxyEnabled : false,
        proxy_type: config.proxyType,
        proxy_host: u.proxy ? config.proxyHost.trim() : "",
        proxy_port: u.proxy && config.proxyPort ? parseInt(config.proxyPort, 10) : null,
        proxy_username: u.proxy ? config.proxyUsername : "",
        proxy_password: u.proxy ? config.proxyPassword : "",
      };

      const { data, error } = await supabase.functions.invoke("trigger-build", {
        body: { ...requestBody, build_id: bId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.build_id) throw new Error("No build_id returned");

      setBuildId(data.build_id);
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message || "Failed to start build");
      if (queueId) markFailed(queueId);
    }
  };

  // Spend coins then start the build
  const spendAndStartBuild = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

    // Deduct coins
    const { error: spendErr } = await supabase.rpc("update_coin_balance", {
      p_user_id: session.user.id,
      p_amount: tier.price,
      p_type: "spend",
      p_description: `Website to APK — ${tier.name}`,
    });
    if (spendErr) {
      toast({ title: "Payment error", description: spendErr.message, variant: "destructive" });
      setStep("config");
      return;
    }
    await Promise.all([fetchBalance(), fetchTransactions()]);
    toast({ title: "Payment successful", description: `${tier.price} coins deducted` });

    const newBuildId = crypto.randomUUID();
    setBuildId(newBuildId);
    const result = await joinQueue(newBuildId);
    if (!result) {
      setStep("error");
      setErrorMsg("Failed to join build queue");
      return;
    }
    if (result.canStart) {
      triggerActualBuild(newBuildId, result.entry.id);
    } else {
      setStep("queued");
    }
  };

  // Razorpay top-up + build
  const payWithRazorpay = async () => {
    if (!razorpayLoaded || !window.Razorpay) {
      toast({ title: "Payment gateway loading…", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    setStep("paying");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please log in again.");

      const amount = tier.price;
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: { amount },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.orderId) throw new Error(data?.error || "Failed to create order");

      const { data: { user } } = await supabase.auth.getUser();

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "GROWHAZ",
        description: `Website to APK — ${tier.name}`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "verify-razorpay-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  amount,
                },
                headers: { Authorization: `Bearer ${session.access_token}` },
              }
            );
            if (verifyError || !verifyData?.success) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }
            await Promise.all([fetchBalance(), fetchTransactions()]);
            // Now deduct and start build
            await spendAndStartBuild();
          } catch (err: any) {
            setStep("error");
            setErrorMsg(err.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setStep("config");
            toast({ title: "Payment cancelled", variant: "default" });
          },
        },
        prefill: { email: user?.email },
        theme: { color: "#10B981" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      rzp.on("payment.failed", (resp: any) => {
        setStep("config");
        toast({
          title: "Payment failed",
          description: resp.error?.description || "Please try again",
          variant: "destructive",
        });
      });
    } catch (err: any) {
      setStep("config");
      toast({ title: "Error", description: err.message || "Payment failed", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!isValid) return;
    if (!isLoggedIn) {
      navigate("/auth");
      onClose();
      return;
    }
    const currentBalance = balance?.balance ?? 0;
    if (currentBalance >= tier.price) {
      // Smooth path: use coins directly
      await spendAndStartBuild();
    } else {
      // Hybrid: pay via Razorpay first, then deduct and build
      await payWithRazorpay();
    }
  };

  const handleDownload = async () => {
    if (!buildId) return;
    setIsDownloading(true);
    try {
      const supabaseUrl = (supabase as any).supabaseUrl || "";
      const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (!projectId) throw new Error("Could not determine Supabase project ID");
      const url = `https://${projectId}.supabase.co/functions/v1/download-apk?build_id=${buildId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${config.appName}.apk`;
      if (contentDisposition) {
        const m = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (m && m[1]) filename = m[1].replace(/['"]/g, "");
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setStep("tier");
    setSelectedTier("basic");
    setConfig({ ...DEFAULT_CONFIG });
    setBuildId(null);
    setErrorMsg("");
    setPollAttempts(0);
    setIsDownloading(false);
    setBuildStatus("");
    if (pollRef.current) clearInterval(pollRef.current);
    resetQueue();
  };

  const handleClose = () => {
    if (step === "generating" || step === "queued" || step === "paying") {
      if (!confirm("A build/payment is in progress. Close anyway?")) return;
    }
    handleReset();
    onClose();
  };

  const outputLabel = tier.unlocks.ios && config.platform === "ios"
    ? "IPA"
    : tier.unlocks.aab && config.buildAab
    ? "AAB"
    : "APK";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Website to App Converter
          </DialogTitle>
          <DialogDescription>
            Turn any website into a native Android app in minutes
          </DialogDescription>
        </DialogHeader>

        {/* --------- STEP: TIER SELECTION --------- */}
        {step === "tier" && (
          <div className="space-y-4 mt-2">
            {isLoggedIn === false && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <LogIn className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Login Required</p>
                  <p className="text-xs text-muted-foreground">
                    You need to log in before using this tool
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigate("/auth"); onClose(); }}
                >
                  Login
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span>Balance: <span className="text-foreground font-medium">{balance?.balance ?? 0}</span> coins</span>
              </div>
              <span>1 coin = ₹1</span>
            </div>

            <p className="text-sm text-muted-foreground">
              Pick a plan. Higher plans unlock more features.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TIERS.map((t) => {
                const Icon = t.icon;
                const active = selectedTier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTier(t.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40 bg-card/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">₹{t.price}</div>
                        <div className="text-[10px] text-muted-foreground -mt-0.5">one-time</div>
                      </div>
                    </div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">{t.tagline}</div>
                    <ul className="space-y-1">
                      {t.features.map((f) => (
                        <li key={f} className="text-[11px] flex items-start gap-1.5 text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full rounded-xl gap-2"
              disabled={isLoggedIn === false}
              onClick={() => setStep("config")}
            >
              Continue with {tier.name} — ₹{tier.price}
            </Button>
          </div>
        )}

        {/* --------- STEP: CONFIG --------- */}
        {step === "config" && (
          <div className="space-y-5 mt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <tier.icon className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{tier.name}</div>
                  <div className="text-[11px] text-muted-foreground">{tier.tagline}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">₹{tier.price}</span>
                <Button variant="ghost" size="sm" onClick={() => setStep("tier")}>
                  Change
                </Button>
              </div>
            </div>

            {/* Required fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Website URL *
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
                  <Smartphone className="w-4 h-4" /> App Name *
                </Label>
                <Input
                  id="appName"
                  placeholder="My Awesome App"
                  value={config.appName}
                  onChange={(e) => patch({ appName: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Branding (locked below tier=logo) */}
            <LockableSection
              title="Custom Branding"
              icon={Palette}
              unlocked={tier.unlocks.customIcon}
              requiredTier="Custom Branding (₹99)"
              onUpgrade={() => setStep("tier")}
            >
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Splash Color</Label>
                  <div className="flex gap-2">
                    <Input
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
                  <Label>Status Bar Color</Label>
                  <div className="flex gap-2">
                    <Input
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
            </LockableSection>

            {/* Advanced features */}
            <LockableSection
              title="Advanced Features"
              icon={Zap}
              unlocked={tier.unlocks.push}
              requiredTier="Advanced (₹499)"
              onUpgrade={() => setStep("tier")}
            >
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enablePush}
                    onChange={(e) => patch({ enablePush: e.target.checked })}
                    className="rounded"
                  />
                  <Bell className="w-3.5 h-3.5" /> Push Notifications
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enableOffline}
                    onChange={(e) => patch({ enableOffline: e.target.checked })}
                    className="rounded"
                  />
                  <Wifi className="w-3.5 h-3.5" /> Offline Support
                </label>
              </div>
            </LockableSection>

            {/* Pro features */}
            <LockableSection
              title="Pro Features"
              icon={Crown}
              unlocked={tier.unlocks.aab}
              requiredTier="Pro (₹999)"
              onUpgrade={() => setStep("tier")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <select
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={config.platform}
                    onChange={(e) => patch({ platform: e.target.value as "android" | "ios" })}
                  >
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input
                    type="checkbox"
                    checked={config.buildAab}
                    onChange={(e) => patch({ buildAab: e.target.checked })}
                    className="rounded"
                  />
                  <Gauge className="w-3.5 h-3.5" /> AAB (Play Store)
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.enableAdmob}
                  onChange={(e) => patch({ enableAdmob: e.target.checked })}
                  className="rounded"
                />
                <Cloud className="w-3.5 h-3.5" /> Enable AdMob
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
                    onChange={(e) => patch({ admobInterstitialId: e.target.value })}
                    className="rounded-xl text-xs"
                  />
                </div>
              )}
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
                  <Input placeholder="Host" value={config.proxyHost}
                    onChange={(e) => patch({ proxyHost: e.target.value })}
                    className="rounded-xl text-xs" />
                  <Input placeholder="Port" value={config.proxyPort}
                    onChange={(e) => patch({ proxyPort: e.target.value })}
                    className="rounded-xl text-xs" />
                </div>
              )}
            </LockableSection>

            {/* Payment summary */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-medium">{balance?.balance ?? 0} coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">This build</span>
                <span className="font-medium">₹{tier.price}</span>
              </div>
              {(balance?.balance ?? 0) < tier.price && (
                <p className="text-amber-500 pt-1">
                  Not enough coins — you'll be redirected to Razorpay to pay ₹{tier.price}. Coins are credited and used automatically.
                </p>
              )}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full h-12 rounded-xl text-base gap-2"
              disabled={!isValid || !isLoggedIn}
              onClick={handleGenerate}
            >
              <Sparkles className="w-4 h-4" />
              {(balance?.balance ?? 0) >= tier.price
                ? `Generate ${outputLabel} — spend ${tier.price} coins`
                : `Pay ₹${tier.price} & Generate ${outputLabel}`}
            </Button>
          </div>
        )}

        {/* --------- STEP: PAYING --------- */}
        {step === "paying" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-semibold">Opening Razorpay…</p>
            <p className="text-xs text-muted-foreground">Complete the ₹{tier.price} payment in the popup</p>
          </div>
        )}

        {/* --------- STEP: QUEUED --------- */}
        {step === "queued" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-500 animate-pulse" />
            </div>
            <p className="font-semibold">Waiting in Queue</p>
            {queuePosition && (
              <p className="text-2xl font-bold text-primary">#{queuePosition}</p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> {activeCount}/20 builds running
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Your build will start automatically when a slot opens. Don't close this page.
            </p>
          </div>
        )}

        {/* --------- STEP: GENERATING --------- */}
        {step === "generating" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-semibold">Building your {outputLabel}…</p>
            <p className="text-sm text-muted-foreground">
              Wrapping <span className="text-foreground font-medium">{config.appName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              This may take 2–5 minutes. Don't close this page.
            </p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-mono">{buildStatus || "Building…"}</span>
            </p>
          </div>
        )}

        {/* --------- STEP: DONE --------- */}
        {step === "done" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <p className="font-semibold text-lg">Your {outputLabel} is ready!</p>
            <Button
              variant="hero"
              size="lg"
              className="rounded-xl gap-2"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download {outputLabel}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Build another app
            </Button>
          </div>
        )}

        {/* --------- STEP: ERROR --------- */}
        {step === "error" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">{errorMsg}</p>
            <Button variant="outline" onClick={handleReset}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Lockable Section helper ----------
function LockableSection({
  title,
  icon: Icon,
  unlocked,
  requiredTier,
  onUpgrade,
  children,
}: {
  title: string;
  icon: React.ElementType;
  unlocked: boolean;
  requiredTier: string;
  onUpgrade: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl p-4 space-y-3 ${unlocked ? "border-border/60" : "border-dashed border-border/40 bg-muted/20"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${unlocked ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {!unlocked && (
          <button
            type="button"
            onClick={onUpgrade}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <Lock className="w-3 h-3" />
            Unlock in {requiredTier}
          </button>
        )}
      </div>
      {unlocked ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Upgrade to {requiredTier} to enable these options.
        </p>
      )}
    </div>
  );
}
