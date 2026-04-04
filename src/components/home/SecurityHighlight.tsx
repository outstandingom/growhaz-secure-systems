import { Link } from "react-router-dom";
import { Shield, CheckCircle2, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: CheckCircle2, label: "SQL Injection Testing" },
  { icon: CheckCircle2, label: "XSS Detection" },
  { icon: CheckCircle2, label: "Security Headers Check" },
  { icon: CheckCircle2, label: "Auth Flow Analysis" },
  { icon: CheckCircle2, label: "X-Header Exposure" },
];

export function SecurityHighlight() {
  return (
    <section className="section-container">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Content */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Top Priority</span>
          </div>

          <h2 className="section-title mb-6">
            Smart Website{" "}
            <span className="gradient-text">Security Testing</span> Tools
          </h2>

          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            GROWHAZ provides real, usable website security testing tools that help businesses 
            identify vulnerabilities before attackers do.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {features.map((feature) => (
              <div key={feature.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                <feature.icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-center">{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/security-tools">
              <Button variant="hero" size="lg" className="group">
                Run Free Security Test
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                Request Advanced Audit
              </Button>
            </Link>
          </div>
        </div>

        {/* Visual */}
        <div className="relative">
          <div className="relative p-8 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground ml-2 font-mono">security-scanner.growhaz</span>
            </div>

            <div className="space-y-4 font-mono text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-primary">$</span>
                <span>Scanning target...</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Security headers: OK</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span>X-Frame-Options: Missing</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>SQL Injection: Protected</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Lock className="w-4 h-4" />
                <span>HTTPS: Enabled</span>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-card/50 border border-border">
                <div className="text-muted-foreground mb-2">Risk Level:</div>
                <div className="text-2xl font-bold text-amber-400">MEDIUM</div>
              </div>
            </div>
          </div>

          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl -z-10 opacity-50" />
        </div>
      </div>
    </section>
  );
}
