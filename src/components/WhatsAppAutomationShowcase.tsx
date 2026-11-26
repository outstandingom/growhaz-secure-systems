import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Calculator,
  Check,
  Coins,
  Gift,
  Headphones,
  Loader2,
  MessageSquare,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WhatsAppAutomationShowcaseProps {
  compactPricingOnly?: boolean;
}

const WHATSAPP_DESK_URL = "https://whatsapp-bot-qtm1.onrender.com";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    conversations: 600,
    managedPrice: 999,
    byoPrice: 499,
    popular: false,
    features: [
      "600 customer 24h windows / month",
      "Supabase Cloud persistent chat memory",
      "OpenRouter prompt-injection shield",
      "Bulk CSV AI personalized campaigns",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    conversations: 2000,
    managedPrice: 2499,
    byoPrice: 1199,
    popular: true,
    features: [
      "2,000 customer 24h windows / month",
      "Full Customer DNA Knowledge Graph",
      "Custom Business Persona & AI training",
      "Priority WhatsApp & Meta webhook sync",
    ],
  },
  {
    id: "pro",
    name: "Pro Scale",
    conversations: 5000,
    managedPrice: 4999,
    byoPrice: 2499,
    popular: false,
    features: [
      "5,000 customer 24h windows / month",
      "Dedicated multi-campaign orchestration",
      "Full API & lead CRM integration",
      "Included 1-on-1 onboarding walkthrough",
    ],
  },
];

export function WhatsAppAutomationShowcase({
  compactPricingOnly = false,
}: WhatsAppAutomationShowcaseProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"managed_meta" | "byo_meta">("managed_meta");
  const [customerCount, setCustomerCount] = useState<number>(200);
  const [launching, setLaunching] = useState(false);

  const unitRate = mode === "byo_meta" ? 1 : 2;
  const estimatedCoins = Math.max(1, customerCount || 0) * unitRate;

  const handleLaunchWorkspace = async () => {
    setLaunching(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const ssoUrl = `${WHATSAPP_DESK_URL}/#sso_token=${encodeURIComponent(
          session.access_token
        )}`;
        window.open(ssoUrl, "_blank", "noopener,noreferrer");
      } else {
        navigate("/auth?redirect=/automation");
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <section
      id="whatsapp-ai-automation"
      className="section-container px-4 sm:px-6"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header & Hero Actions */}
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-card to-card p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  WhatsApp AI SaaS
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                  <Gift className="w-3.5 h-3.5 mr-1.5" />
                  3 Free Demos Included
                </Badge>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <Coins className="w-3.5 h-3.5 mr-1.5" />
                  1 Growhaz Coin = ₹1
                </Badge>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                AI-Powered WhatsApp Business Automation &amp; DNA CRM
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Sign in with your Growhaz account, spend Wallet Coins flexibly per
                24-hour conversation (<strong>₹2 Managed Meta</strong> or{" "}
                <strong>₹1 Own Meta</strong>), or lock in half-price monthly
                plans once you connect your Meta Cloud API. Test 3 demos free
                before adding any Meta tokens.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Button
                size="lg"
                onClick={handleLaunchWorkspace}
                disabled={launching}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {launching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opening Desk...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Launch WhatsApp AI Desk
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/wallet">
                  <Coins className="w-4 h-4 mr-2 text-amber-400" />
                  Add Coins to Wallet
                </Link>
              </Button>
            </div>
          </div>

          {!compactPricingOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/60">
              <div className="rounded-xl bg-background/60 border border-border/60 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <Gift className="w-4 h-4" />
                  <span>3 Free Demos</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Test AI customer conversations immediately on our simulator before setting up Meta.
                </p>
              </div>
              <div className="rounded-xl bg-background/60 border border-border/60 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Prompt-Injection Shield</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  OpenRouter classifier inspects untrusted inputs to block system leaks &amp; jailbreaks.
                </p>
              </div>
              <div className="rounded-xl bg-background/60 border border-border/60 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
                  <Network className="w-4 h-4" />
                  <span>Supabase DNA Knowledge Graph</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maps business entities, cities &amp; tools in Supabase Postgres so chat history persists forever.
                </p>
              </div>
              <div className="rounded-xl bg-background/60 border border-border/60 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <Coins className="w-4 h-4" />
                  <span>Growhaz Wallet Sync</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use existing Growhaz Wallet Coins seamlessly across WhatsApp automation &amp; plans.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mode Toggle + 24h Cost Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <Card className="lg:col-span-7 border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">
                Choose Meta Setup Mode (Switch Anytime)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("managed_meta")}
                className={`text-left p-4 rounded-2xl border-2 transition ${
                  mode === "managed_meta"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border bg-card hover:border-emerald-500/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm">Managed Meta + Infra</span>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    ₹2 / 24h conv
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ₹1 Growhaz Infrastructure + ₹1 Meta messaging per 24h window.
                  200 customers = <strong>400 Coins</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("byo_meta")}
                className={`text-left p-4 rounded-2xl border-2 transition ${
                  mode === "byo_meta"
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-border bg-card hover:border-indigo-500/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm">Own Meta Account (50% Off)</span>
                  <Badge className="bg-indigo-600 text-white text-xs">
                    ₹1 / 24h conv
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ₹1 Growhaz Infrastructure only when you connect your own Meta API
                  and fund Meta directly. 200 customers = <strong>200 Coins</strong>.
                </p>
              </button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5 border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" />
                24-Hour Conversation Cost Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="wa-cost-calc-input"
                  className="text-xs sm:text-sm text-muted-foreground font-medium"
                >
                  Customers to message (24h):
                </label>
                <input
                  id="wa-cost-calc-input"
                  type="number"
                  min={1}
                  max={100000}
                  value={customerCount}
                  onChange={(e) =>
                    setCustomerCount(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-bold text-center"
                />
              </div>
              <div className="rounded-xl bg-muted/60 border border-border/60 p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {mode === "byo_meta"
                    ? "Own Meta Infra Rate (₹1 / conv)"
                    : "Managed Meta Rate (₹2 / conv)"}
                </span>
                <span className="text-base sm:text-lg font-extrabold text-amber-400">
                  {estimatedCoins.toLocaleString()} Coins (₹
                  {estimatedCoins.toLocaleString()})
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {PLANS.map((plan) => {
            const activePrice =
              mode === "byo_meta" ? plan.byoPrice : plan.managedPrice;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between ${
                  plan.popular
                    ? "border-emerald-500/70 shadow-lg shadow-emerald-500/10"
                    : "border-border/70"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-emerald-600 text-white">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-2 pt-2">
                    {mode === "byo_meta" && (
                      <span className="text-sm line-through text-muted-foreground">
                        ₹{plan.managedPrice}
                      </span>
                    )}
                    <span className="text-3xl font-extrabold">₹{activePrice}</span>
                    <span className="text-xs text-muted-foreground">
                      / month ({activePrice} Coins)
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-400 mt-1">
                    {plan.conversations.toLocaleString()} conversations / month
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={handleLaunchWorkspace}
                  >
                    Activate in Desk
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 1-on-1 Mentor Setup Card */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <Headphones className="w-4 h-4" />
              <span>Need help setting up Meta WhatsApp Cloud API?</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Most business owners haven&apos;t configured Meta Developer Apps,
              Business Verification, or Webhooks before. Connect 1-on-1 with a
              Growhaz Mentor to set up your Meta account live and unlock 50%
              half-price infrastructure plans.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Link to="/mentorship?topic=meta-whatsapp-setup">
                <Headphones className="w-4 h-4 mr-2" />
                Connect With Mentor (1-on-1)
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact?service=automation">Request Done-For-You</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
