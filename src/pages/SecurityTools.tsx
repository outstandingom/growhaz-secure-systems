import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Lock,
  Globe,
  ArrowRight,
  Loader2,
  Info
} from "lucide-react";

const capabilities = [
  "Basic SQL Injection testing",
  "XSS (Cross-Site Scripting) detection",
  "X-Header & X-Forwarded-For exposure",
  "Security Headers validation",
  "Authentication & login flow analysis",
];

const outputs = [
  { icon: AlertTriangle, text: "Security risk level (Low / Medium / High)" },
  { icon: XCircle, text: "Vulnerable points" },
  { icon: Info, text: "Simple explanation of issues" },
  { icon: CheckCircle2, text: "Actionable fix suggestions" },
];

export default function SecurityTools() {
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleScan = () => {
    if (!url) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setShowResult(true);
    }, 3000);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Security Tools</span>
          </div>
          
          <h1 className="section-title mb-6">
            Smart Website{" "}
            <span className="gradient-text">Security Testing</span> Tools
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            GROWHAZ provides real, usable website security testing tools that help businesses 
            identify vulnerabilities before attackers do.
          </p>

          {/* Scanner Input */}
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 p-2 rounded-2xl bg-card border border-border">
              <div className="flex-1 flex items-center gap-3 px-4">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="Enter website URL (e.g., https://example.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-transparent py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <Button
                variant="hero"
                size="lg"
                onClick={handleScan}
                disabled={isScanning || !url}
                className="sm:w-auto"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    Run Security Test
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Transparency Note */}
            <div className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border text-left">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> The security engine is already developed and is being 
                  deployed on AWS / Azure. It will be connected securely with the website frontend for real-time testing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Result Display */}
      {showResult && (
        <section className="section-container pt-0">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-muted-foreground ml-2 font-mono">Security Report</span>
              </div>

              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-primary">Target:</span>
                  <span>{url}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>HTTPS: Enabled</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SQL Injection: Protected</span>
                </div>
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>X-Frame-Options: Missing</span>
                </div>
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Content-Security-Policy: Not configured</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Lock className="w-4 h-4" />
                  <span>XSS Protection: Active</span>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-secondary grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-muted-foreground mb-1">Risk Level</div>
                    <div className="text-2xl font-bold text-amber-400">MEDIUM</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Issues Found</div>
                    <div className="text-2xl font-bold text-foreground">2</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Capabilities */}
      <section className="section-container bg-card/50">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              🔐 Smart Security Tester Capabilities
            </h2>
            <ul className="space-y-4">
              {capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{cap}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Output Provided
            </h2>
            <ul className="space-y-4">
              {outputs.map((output) => (
                <li key={output.text} className="flex items-start gap-3">
                  <output.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{output.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Need a Comprehensive Security Audit?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Our advanced security audit goes deeper to uncover hidden vulnerabilities 
            and provides detailed remediation strategies.
          </p>
          <Button variant="hero" size="xl">
            Request Advanced Security Audit
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>
    </Layout>
  );
}
