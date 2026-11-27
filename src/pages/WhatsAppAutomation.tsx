import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Headphones, MessageSquare, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsAppAutomationShowcase } from "@/components/WhatsAppAutomationShowcase";

export default function WhatsAppAutomation() {
  return (
    <Layout>
      <Seo
        title="WhatsApp Business AI & DNA CRM Automation | GrowHaz"
        description="Dedicated WhatsApp Business AI automation service with Supabase DNA Knowledge Graph memory, OpenRouter prompt-injection shield, 3 free demos, and ₹1–₹2/conversation pricing."
        path="/automation/whatsapp"
      />

      {/* Hero Section */}
      <section className="section-container px-4 sm:px-6 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/automation"
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Automation Services
            </Link>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Dedicated WhatsApp Automation Service
            </Badge>
          </div>

          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              WhatsApp Business <span className="gradient-text">AI &amp; DNA CRM</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Deploy an intelligent 24/7 WhatsApp assistant connected to your Meta Cloud API,
              persistent Supabase memory, and live DNA Knowledge Graph. Start with 3 free demos
              and pay only ₹1–₹2 per 24-hour conversation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-4">
              <div className="p-4 rounded-xl bg-card/50 border border-border">
                <MessageSquare className="w-5 h-5 text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold">3 Free Live Demos</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Test real WhatsApp automation immediately before connecting your Meta account.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card/50 border border-border">
                <Network className="w-5 h-5 text-indigo-400 mb-2" />
                <h3 className="text-sm font-semibold">DNA Knowledge Graph</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Remembers customer business info, competitors, and history across sessions.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card/50 border border-border">
                <ShieldCheck className="w-5 h-5 text-primary mb-2" />
                <h3 className="text-sm font-semibold">OpenRouter Security Shield</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Blocks prompt injection and secret leaks while protecting every tenant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Desk Launch, Mode Switcher, Plans & Coin Calculator */}
      <WhatsAppAutomationShowcase />

      {/* Hire a WhatsApp Setup Mentor / Consultant CTA */}
      <section className="section-container px-4 sm:px-6 pt-0">
        <div className="max-w-5xl mx-auto rounded-2xl border border-indigo-500/30 bg-card/60 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400">
              <Headphones className="w-4 h-4" />
              Need Help Setting Up Meta Cloud API or Webhooks?
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              Hire a WhatsApp Automation Consultant or Mentor
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Choose a dedicated mentor in our Mentorship &amp; Learning section to set up your
              Meta Business App, Phone Number ID, and webhook live—or learn how to manage it yourself.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Button asChild className="gap-2">
              <Link to="/mentorship?service=whatsapp-automation">
                <Bot className="w-4 h-4" />
                Find WhatsApp Mentor
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact?service=whatsapp-automation">Request Setup Help</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
