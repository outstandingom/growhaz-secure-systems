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
  Bell,
  Wifi,
  Gauge,
  Cloud,
  LogIn,
  Coins,
  Clock,
  Users,
  Lock,
  Crown,
  Zap,
  Package,
  Apple,
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
  unlocks: {
    customIcon: boolean;
    customColors: boolean;
    ios: boolean;
    push: boolean;
    offline: boolean;
    splashScreen: boolean;
    aab: boolean;
    admob: boolean;
  };
}

const GROWHAZ_ICON_URL = "https://growhaz-secure-systems.vercel.app/favicon.png";

const TIERS: TierDef[] = [
  {
    id: "basic",
    name: "Basic",
    price: 49,
    tagline: "Quick APK with GrowHaz branding",
    icon: Smartphone,
    unlocks: {
      customIcon: false, customColors: false, ios: false,
      push: false, offline: false, splashScreen: false,
      aab: false, admob: false,
    },
  },
  {
    id: "logo",
    name: "Custom Branding",
    price: 99,
    tagline: "Your own logo, colors & iOS build",
    icon: Palette,
    unlocks: {
      customIcon: true, customColors: true, ios: true,
      push: false, offline: false, splashScreen: false,
      aab: false, admob: false,
    },
  },
  {
    id: "advanced",
    name: "Advanced",
    price: 499,
    tagline: "Splash screen, push & offline",
    icon: Zap,
    unlocks: {
      customIcon: true, customColors: true, ios: true,
      push: true, offline: true, splashScreen: true,
      aab: false, admob: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    tagline: "AdMob + Play Store AAB",
    icon: Crown,
    unlocks: {
      customIcon: true, customColors: true, ios: true,
      push: true, offline: true, splashScreen: true,
      aab: true, admob: true,
    },
  },
];

const getTier = (id: TierId): TierDef => TIERS.find((t) => t.id === id)!;
const nextTier = (id: TierId): TierDef | null => {
  const idx = TIERS.findIndex((t) => t.id === id);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
};

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
  enableCookies: boolean;
  enableAdmob: boolean;
  admobBannerId: string;
  admobInterstitialId: string;
}

const DEFAULT_CONFIG: BuildConfig = {
  websiteUrl: "",
  appName: "",
  packageName: "",
  logoPreview: "",
  splashColor: "#FFFFFF",
  statusBarColor: "#FFFFFF",
  platform: "android",
  buildAab: false,
  enablePush: false,
  enableOffline: false,
  offlineMessage: "You are offline. Please check your connection.",
  enableCookies: true,
  enableAdmob: false,
  admobBannerId: "",
  admobInterstitialId: "",
};

interface ConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "config" | "paying" | "queued" | "generating" | "done" | "error";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PACKAGE_NAME_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/;

const sanitizeForPackage = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "app";

export function ConverterModal({ isOpen, onClose }: ConverterModalProps) {
  const [selectedTier, setSelectedTier] = useState<TierId>("basic");
  const [config, setConfig] = useState<BuildConfig>({ ...DEFAULT_CONFIG });
  const [step, setStep] = useState<Step>("config");
  const [buildId, setBuildId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pollAttempts, setPollAttempts] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [packageEdited, setPackageEdited] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, fetchBalance, fetchTransactions } = useWallet();

  const tier = getTier(selectedTier);
  const next = nextTier(selectedTier);

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

  const packageValid = PACKAGE_NAME_REGEX.test(config.packageName.trim());
  const isValid =
    config.websiteUrl.trim().length > 0 &&
    config.appName.trim().length > 0 &&
    packageValid;

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
  }, [isOpen]);

  // Auto-generate package name from app name (until user edits)
  useEffect(() => {
    if (!packageEdited && config.appName.trim()) {
      const sanitized = sanitizeForPackage(config.appName);
      const suffix = Math.random().toString(36).slice(2, 6);
      setConfig((c) => ({ ...c, packageName: `com.growhaz.${sanitized}${suffix}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.appName]);

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
            .select("status, error_message, github_run_id, download_url, file_name")
            .eq("id", buildId)
            .single();
          const build = data as any;
          setBuildStatus(build?.status || "");
          if (build?.status === "completed") {
            let finalUrl: string | null = build?.download_url || null;
            const fileName = build?.file_name || `${config.appName}.apk`;
            if (!finalUrl && buildId) {
              // download_url wasn't written back by the workflow — sign a URL from storage
              const { data: signed } = await supabase.storage
                .from("app-builds")
                .createSignedUrl(`${buildId}/app.apk`, 3600, { download: fileName });
              finalUrl = signed?.signedUrl || null;
            }
            setDownloadUrl(finalUrl);
            setDownloadFileName(fileName);
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

      const iconUrl = u.customIcon && config.logoPreview
        ? config.logoPreview
        : GROWHAZ_ICON_URL;
      const splashColor = u.customColors ? config.splashColor : "#FFFFFF";
      const statusBarColor = u.customColors ? config.statusBarColor : "#FFFFFF";
      const platform = u.ios ? config.platform : "android";
      const buildAab = u.aab ? config.buildAab : false;

      const requestBody = {
        website_url: websiteUrl,
        app_name: config.appName.trim(),
        package_name: config.packageName.trim(),
        icon_url: iconUrl,
        splash_color: splashColor,
        status_bar_color: statusBarColor,
        enable_push: u.push ? config.enablePush : false,
        enable_offline: u.offline ? config.enableOffline : false,
        offline_message: config.offlineMessage,
        enable_analytics: false,
        enable_cookies: config.enableCookies,
        enable_admob: u.admob ? config.enableAdmob : false,
        admob_banner_id: u.admob && config.enableAdmob ? (config.admobBannerId || null) : null,
        admob_interstitial_id: u.admob && config.enableAdmob ? (config.admobInterstitialId || null) : null,
        build_aab: buildAab,
        platform,
        tier: tier.id,
        proxy_enabled: false,
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

  const spendAndStartBuild = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

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

    // Pre-create the apk_builds row so it is owned by this user and shows up
    // in their profile history. The workflow/callback updates the same row.
    let websiteUrl = config.websiteUrl.trim();
    if (!websiteUrl.startsWith("http")) websiteUrl = "https://" + websiteUrl;
    const u = tier.unlocks;
    const platform = u.ios ? config.platform : "android";
    await supabase.from("apk_builds").insert({
      id: newBuildId,
      user_id: session.user.id,
      app_name: config.appName.trim(),
      website_url: websiteUrl,
      package_name: config.packageName.trim(),
      platform,
      tier: tier.id,
      status: "pending",
      storage_path: `${newBuildId}/app.apk`,
      file_name: `${config.appName.trim() || "app"}.apk`,
    });
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

  const finalPrice = discountApplied ? Math.floor(tier.price * 0.8) : tier.price;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const { data, error } = await supabase
        .from("partner_profiles")
        .select("partner_code")
        .eq("partner_code", couponCode.trim())
        .single();
      
      if (error || !data) {
        setCouponError("Invalid coupon code");
        setDiscountApplied(false);
      } else {
        setDiscountApplied(true);
        toast({ title: "Coupon Applied!", description: "You get 20% off this build." });
      }
    } catch (err) {
      setCouponError("Error validating coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const payWithRazorpay = async () => {
    if (!razorpayLoaded || !window.Razorpay) {
      toast({ title: "Payment gateway loading…", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    setStep("paying");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please log in again.");

      const amount = finalPrice;
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: { amount, couponCode: discountApplied ? couponCode.trim() : null },
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
    if (!isValid) {
      if (!packageValid) {
        toast({
          title: "Invalid package name",
          description: "Must look like com.company.appname (lowercase, at least 2 dots)",
          variant: "destructive",
        });
      }
      return;
    }
    if (!isLoggedIn) {
      navigate("/auth");
      onClose();
      return;
    }
    const currentBalance = balance?.balance ?? 0;
    if (currentBalance >= finalPrice) {
      await spendAndStartBuild();
    } else {
      await payWithRazorpay();
    }
  };

  // Downloads directly from the signed Supabase Storage URL saved on the build row.
  // We navigate the browser straight to the signed URL instead of using fetch()+blob:
  // fetch() to a cross-origin Storage host can be blocked/opaque due to CORS, whereas
  // a plain anchor click is a normal top-level navigation and always works. The signed
  // URL itself was created with a `download` filename (see build-callback), so the
  // browser saves it with the right name and forces a download instead of opening inline.
  const handleDownload = () => {
    if (!downloadUrl) {
      toast({
        title: "Download not ready",
        description: "The file isn't ready yet. Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = downloadFileName || `${config.appName}.apk`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setStep("config");
    setSelectedTier("basic");
    setConfig({ ...DEFAULT_CONFIG });
    setPackageEdited(false);
    setBuildId(null);
    setErrorMsg("");
    setPollAttempts(0);
    setIsDownloading(false);
    setBuildStatus("");
    setDownloadUrl(null);
    setDownloadFileName("");
    setCouponCode("");
    setDiscountApplied(false);
    setCouponError("");
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
            Enter your website URL and turn it into a real Android app in minutes.
          </DialogDescription>
        </DialogHeader>

        {/* --------- STEP: CONFIG --------- */}
        {step === "config" && (
          <div className="space-y-5 mt-2">
            {isLoggedIn === false && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <LogIn className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Login Required</p>
                  <p className="text-xs text-muted-foreground">
                    You need to log in before generating an app
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

            {/* Required inputs — always visible */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Website URL *
                </Label>
                <Input
                  id="websiteUrl"
                  placeholder="https://your-website.com"
                  value={config.websiteUrl}
                  onChange={(e) => patch({ websiteUrl: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="appName" className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> App Name *
                  </Label>
                  <Input
                    id="appName"
                    placeholder="My App"
                    value={config.appName}
                    onChange={(e) => patch({ appName: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="packageName" className="flex items-center gap-2">
                    <Package className="w-4 h-4" /> Package Name *
                  </Label>
                  <Input
                    id="packageName"
                    placeholder="com.company.appname"
                    value={config.packageName}
                    onChange={(e) => {
                      setPackageEdited(true);
                      patch({ packageName: e.target.value.toLowerCase() });
                    }}
                    className={`rounded-xl font-mono text-xs ${
                      config.packageName && !packageValid ? "border-destructive" : ""
                    }`}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Must be unique, e.g. <span className="font-mono">com.growhaz.myapp</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Current plan indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <tier.icon className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{tier.name} — ₹{tier.price}</div>
                  <div className="text-[11px] text-muted-foreground">{tier.tagline}</div>
                </div>
              </div>
              {selectedTier !== "basic" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedTier("basic")}
                >
                  Reset to Basic
                </Button>
              )}
            </div>

            {/* ---- Custom Branding (₹99) ---- */}
            <UpgradeSection
              title="Set your own logo & colors"
              icon={Palette}
              unlocked={tier.unlocks.customIcon}
              upgradePrice={99}
              onUpgrade={() => setSelectedTier((t) => (t === "basic" ? "logo" : t))}
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
                <ColorField
                  label="Splash Color"
                  value={config.splashColor}
                  onChange={(v) => patch({ splashColor: v })}
                />
                <ColorField
                  label="Status Bar Color"
                  value={config.statusBarColor}
                  onChange={(v) => patch({ statusBarColor: v })}
                />
              </div>
              {tier.unlocks.ios && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Apple className="w-3.5 h-3.5" /> Target Platform
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => patch({ platform: "android" })}
                      className={`px-3 py-2 rounded-xl border text-sm flex items-center justify-center gap-2 ${
                        config.platform === "android"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      <Smartphone className="w-4 h-4" /> Android
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ platform: "ios" })}
                      className={`px-3 py-2 rounded-xl border text-sm flex items-center justify-center gap-2 ${
                        config.platform === "ios"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      }`}
                    >
                      <Apple className="w-4 h-4" /> iOS
                    </button>
                  </div>
                </div>
              )}
            </UpgradeSection>

            {/* ---- Advanced (₹499) ---- */}
            <UpgradeSection
              title="Advanced: splash, push & offline"
              icon={Zap}
              unlocked={tier.unlocks.push}
              upgradePrice={499}
              onUpgrade={() =>
                setSelectedTier((t) => (t === "basic" || t === "logo" ? "advanced" : t))
              }
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
              {config.enableOffline && (
                <Input
                  placeholder="Offline message"
                  value={config.offlineMessage}
                  onChange={(e) => patch({ offlineMessage: e.target.value })}
                  className="rounded-xl text-xs"
                />
              )}
            </UpgradeSection>

            {/* ---- Pro (₹999) ---- */}
            <UpgradeSection
              title="Pro: AdMob & Play Store bundle"
              icon={Crown}
              unlocked={tier.unlocks.aab}
              upgradePrice={999}
              onUpgrade={() => setSelectedTier("pro")}
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.buildAab}
                  onChange={(e) => patch({ buildAab: e.target.checked })}
                  className="rounded"
                />
                <Gauge className="w-3.5 h-3.5" /> Build AAB (Play Store)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.enableAdmob}
                  onChange={(e) => patch({ enableAdmob: e.target.checked })}
                  className="rounded"
                />
                <Cloud className="w-3.5 h-3.5" /> Enable AdMob Monetization
              </label>
              {config.enableAdmob && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Banner Ad Unit ID</Label>
                    <Input
                      placeholder="ca-app-pub-xxx/xxx"
                      value={config.admobBannerId}
                      onChange={(e) => patch({ admobBannerId: e.target.value })}
                      className="rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Interstitial Ad Unit ID</Label>
                    <Input
                      placeholder="ca-app-pub-xxx/xxx"
                      value={config.admobInterstitialId}
                      onChange={(e) => patch({ admobInterstitialId: e.target.value })}
                      className="rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </UpgradeSection>

            {/* Balance & payment summary */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-primary" /> Your balance
                </span>
                <span className="font-medium">{balance?.balance ?? 0} coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">This build ({tier.name})</span>
                <div className="text-right">
                  {discountApplied && <span className="line-through text-muted-foreground mr-2">₹{tier.price}</span>}
                  <span className="font-medium">₹{finalPrice}</span>
                </div>
              </div>
              {(balance?.balance ?? 0) < finalPrice && (
                <p className="text-amber-500 pt-1">
                  Not enough coins — you'll pay ₹{finalPrice} via Razorpay. Coins are credited & used automatically.
                </p>
              )}
            </div>

            {/* Coupon Code Section */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Have a Partner Code?</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code (e.g. PARTNER-123)"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setDiscountApplied(false);
                    setCouponError("");
                  }}
                  className="rounded-xl h-10 flex-1"
                  disabled={validatingCoupon || discountApplied}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || validatingCoupon || discountApplied}
                  className="h-10 rounded-xl"
                >
                  {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : discountApplied ? "Applied" : "Apply"}
                </Button>
              </div>
              {couponError && <p className="text-[11px] text-destructive">{couponError}</p>}
              {discountApplied && <p className="text-[11px] text-emerald-500">20% discount applied!</p>}
            </div>

            <Button
              variant="hero"
              size="lg"
              className="w-full h-12 rounded-xl text-base gap-2"
              disabled={!isValid || !isLoggedIn}
              onClick={handleGenerate}
            >
              <Sparkles className="w-4 h-4" />
              {(balance?.balance ?? 0) >= finalPrice
                ? `Generate ${outputLabel} — spend ${finalPrice} coins`
                : `Pay ₹${finalPrice} & Generate ${outputLabel}`}
            </Button>

            {next && (
              <p className="text-center text-[11px] text-muted-foreground">
                Want more? Upgrade to <button
                  type="button"
                  onClick={() => setSelectedTier(next.id)}
                  className="text-primary hover:underline font-medium"
                >{next.name} (₹{next.price})</button> for {next.tagline.toLowerCase()}.
              </p>
            )}
          </div>
        )}

        {/* --------- STEP: PAYING --------- */}
        {step === "paying" && (
          <div className="flex flex-col items-center py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="font-semibold">Opening Razorpay…</p>
            <p className="text-xs text-muted-foreground">Complete the ₹{finalPrice} payment in the popup</p>
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
              disabled={isDownloading || !downloadUrl}
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

// ---------- Upgrade Section ----------
function UpgradeSection({
  title,
  icon: Icon,
  unlocked,
  upgradePrice,
  onUpgrade,
  children,
}: {
  title: string;
  icon: React.ElementType;
  unlocked: boolean;
  upgradePrice: number;
  onUpgrade: () => void;
  children: React.ReactNode;
}) {
  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" /> {title}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Tap to unlock — adds ₹{upgradePrice} total
            </div>
          </div>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          ₹{upgradePrice}
        </span>
      </button>
    );
  }
  return (
    <div className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/[0.02]">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-primary ml-auto" />
      </div>
      {children}
    </div>
  );
}

// ---------- Color Field ----------
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 p-1 rounded-xl"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-xl font-mono text-xs"
        />
      </div>
    </div>
  );
}
