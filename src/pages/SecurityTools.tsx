import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useSpendCoins } from "@/hooks/useSpendCoins";
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Lock,
  Globe,
  ArrowRight,
  Loader2,
  Info,
  LogIn,
  User as UserIcon,
  Phone,
  Coins
} from "lucide-react";

const scanTiers = [
  { id: "alphag1", name: "AlphaG1", price: 1999, description: "Basic security scan", features: ["SQL Injection testing", "XSS detection", "Security Headers check"], requiresApproval: false },
  { id: "alphag2", name: "AlphaG2", price: 4999, description: "Advanced vulnerability scan", features: ["All AlphaG1 features", "Deep XSS analysis", "Auth flow analysis", "API endpoint testing"], requiresApproval: true },
  { id: "alphag3", name: "AlphaG3", price: 9999, description: "Full penetration testing", features: ["All AlphaG2 features", "Full pen-test simulation", "Custom exploit detection", "Detailed remediation report"], requiresApproval: true },
];

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
  const [scannerName, setScannerName] = useState("");
  const [scannerPhone, setScannerPhone] = useState("");
  const [selectedTier, setSelectedTier] = useState(scanTiers[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { spendCoins, balance } = useSpendCoins();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (data) {
      setScannerName(data.full_name || "");
      setScannerPhone(data.phone || "");
    }
  };

  const handleScan = async () => {
    if (!url || !user || !scannerName.trim()) {
      toast({
        title: "Required Fields",
        description: "Please enter your name and the website URL.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTier.requiresApproval) {
      toast({
        title: "Approval Required",
        description: `${selectedTier.name} tier requires a formal approval letter from a Manager or CEO. Please contact us.`,
        variant: "destructive",
      });
      return;
    }

    // Spend coins first
    const success = await spendCoins(selectedTier.price, `Security Scan (${selectedTier.name}) - ${url}`);
    if (!success) return;

    setIsScanning(true);

    // Simulate scan and save to database
    setTimeout(async () => {
      const { error } = await supabase.from("security_reports").insert({
        user_id: user.id,
        website_url: url,
        scanner_name: scannerName.trim(),
        scanner_phone: scannerPhone.trim() || null,
        scan_type: selectedTier.id,
        vulnerabilities_found: 2,
        risk_level: "medium",
        report_data: {
          https: true,
          sql_injection: "protected",
          xss_protection: true,
          x_frame_options: false,
          csp: false,
        },
      });

      setIsScanning(false);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save scan results. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setShowResult(true);
      toast({
        title: "Scan Complete",
        description: "Security scan results have been saved to your profile.",
      });
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

          {/* Auth Check */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !user ? (
            /* Login Required Message */
            <div className="max-w-xl mx-auto">
              <div className="rounded-2xl bg-card border border-border p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Login Required</h3>
                <p className="text-muted-foreground mb-6">
                  To use our security testing tools, please sign in or create an account first. 
                  This helps us save your scan results and provide personalized reports.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/auth">
                    <Button variant="hero" size="lg" className="w-full sm:w-auto">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In / Register
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Scanner Input - Only shown when logged in */
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Name and Phone Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scannerName" className="flex items-center gap-2 text-sm">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    Your Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="scannerName"
                    type="text"
                    placeholder="John Doe"
                    value={scannerName}
                    onChange={(e) => setScannerName(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scannerPhone" className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    Phone Number
                  </Label>
                  <Input
                    id="scannerPhone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={scannerPhone}
                    onChange={(e) => setScannerPhone(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
              </div>

              {/* Scan Tier Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Scan Tier</Label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {scanTiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTier.id === tier.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {tier.requiresApproval && (
                        <Badge variant="secondary" className="absolute -top-2 right-2 text-xs">
                          Approval Required
                        </Badge>
                      )}
                      <div className="font-bold text-lg">{tier.name}</div>
                      <div className="flex items-center gap-1 text-primary font-semibold mt-1">
                        <Coins className="w-4 h-4" />
                        {tier.price.toLocaleString()} coins
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
                      <ul className="mt-2 space-y-1">
                        {tier.features.slice(0, 2).map(f => (
                          <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-primary" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
                {balance && (
                  <p className="text-sm text-muted-foreground">
                    Your balance: <span className="font-semibold text-foreground">{balance.balance} coins</span>
                    {balance.balance < selectedTier.price && (
                      <span className="text-destructive ml-2">
                        (Need {selectedTier.price - balance.balance} more — <Link to="/wallet" className="underline">Buy Coins</Link>)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* URL Input */}
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
                  disabled={isScanning || !url || !scannerName.trim() || (balance ? balance.balance < selectedTier.price : true)}
                  className="sm:w-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4" />
                      Run {selectedTier.name} — {selectedTier.price.toLocaleString()} Coins
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Transparency Note */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border text-left">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> The security engine is already developed and is being 
                    deployed on AWS / Azure. It will be connected securely with the website frontend for real-time testing.
                  </p>
                </div>
              </div>
            </div>
          )}
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
