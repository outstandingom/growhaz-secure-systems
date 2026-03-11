import { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Loader2,
  Info,
  LogIn,
  User as UserIcon,
  Phone,
  Coins,
  ChevronLeft,
  ChevronRight,
  Clock
} from "lucide-react";

const scanTiers = [
  {
    id: "alphag1",
    name: "AlphaG1",
    price: 1999,
    description: "Basic Security Scan",
    comingSoon: false,
    requiresApproval: false,
    tests: [
      { name: "SQL Injection Testing", desc: "Tests login, search & API endpoints with 11+ SQL injection payloads including time-based, boolean-based, and UNION attacks" },
      { name: "XSS Detection", desc: "Scans for Cross-Site Scripting with 8 payload types across registration, contact & profile endpoints" },
      { name: "Authentication Flaws", desc: "Checks weak password acceptance, user enumeration via error messages, and rate limiting on login" },
      { name: "IDOR Vulnerability", desc: "Tests Insecure Direct Object Reference by accessing other users' profiles, orders, documents & payments" },
      { name: "CORS Misconfiguration", desc: "Detects dangerous CORS settings allowing arbitrary origins with credentials" },
      { name: "Sensitive Data Exposure", desc: "Scans for exposed .env, config.json, .git/config, backup.sql and more sensitive files" },
      { name: "Security Headers Check", desc: "Validates X-Frame-Options, CSP, HSTS, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy" },
      { name: "SSL/TLS Analysis", desc: "Checks HTTPS enforcement and SSL/TLS certificate configuration" },
    ],
  },
  {
    id: "alphag2",
    name: "AlphaG2",
    price: 4999,
    description: "Advanced Vulnerability Scan",
    comingSoon: true,
    requiresApproval: true,
    tests: [
      { name: "All AlphaG1 Tests", desc: "Includes every test from AlphaG1" },
      { name: "Deep XSS Analysis", desc: "DOM-based and stored XSS detection" },
      { name: "Auth Flow Analysis", desc: "OAuth, JWT & session management testing" },
      { name: "API Endpoint Testing", desc: "Full REST API fuzzing and validation" },
    ],
  },
  {
    id: "alphag3",
    name: "AlphaG3",
    price: 9999,
    description: "Full Penetration Testing",
    comingSoon: true,
    requiresApproval: true,
    tests: [
      { name: "All AlphaG2 Tests", desc: "Includes every test from AlphaG2" },
      { name: "Full Pen-Test Simulation", desc: "Automated penetration testing workflow" },
      { name: "Custom Exploit Detection", desc: "Zero-day and custom exploit scanning" },
      { name: "Detailed Remediation Report", desc: "Step-by-step fix guide with code examples" },
    ],
  },
];

const outputs = [
  { icon: AlertTriangle, text: "Security risk level (Low / Medium / High)" },
  { icon: XCircle, text: "Vulnerable points with details" },
  { icon: Info, text: "Simple explanation of each issue" },
  { icon: CheckCircle2, text: "Actionable fix suggestions" },
];

export default function SecurityTools() {
  const [url, setUrl] = useState("");
  const [scannerName, setScannerName] = useState("");
  const [scannerPhone, setScannerPhone] = useState("");
  const [currentTierIndex, setCurrentTierIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const { toast } = useToast();
  const { spendCoins, balance } = useSpendCoins();

  const selectedTier = scanTiers[currentTierIndex];

  const goNext = () => setCurrentTierIndex((i) => Math.min(i + 1, scanTiers.length - 1));
  const goPrev = () => setCurrentTierIndex((i) => Math.max(i - 1, 0));

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    setTouchStart(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) fetchProfile(session.user.id);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
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
      variant: "destructive"
    });
    return;
  }

  if (selectedTier.comingSoon) {
    toast({
      title: "Coming Soon",
      description: `${selectedTier.name} is not yet available.`,
      variant: "destructive"
    });
    return;
  }

  if (selectedTier.requiresApproval) {
    toast({
      title: "Approval Required",
      description: `${selectedTier.name} requires approval.`,
      variant: "destructive"
    });
    return;
  }

  const success = await spendCoins(
    selectedTier.price,
    `Security Scan (${selectedTier.name}) - ${url}`
  );

  if (!success) return;

  setIsScanning(true);

  // STEP 1: create scan request in database
  const { data, error } = await supabase
    .from("security_reports")
    .insert({
      user_id: user.id,
      website_url: url,
      scanner_name: scannerName.trim(),
      scanner_phone: scannerPhone.trim() || null,
      scan_type: selectedTier.id,
      vulnerabilities_found: 0,
      risk_level: "pending",
      report_data: null,
      report_status: "pending",
      report_url: null
    })
    .select()
    .single();

  if (error) {
    setIsScanning(false);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
    return;
  }

  try {

    // STEP 2: trigger GitHub scanner
    await supabase.rpc("trigger_security_scan", {
      scan_url: url
    });

    setIsScanning(false);
    setShowResult(true);

    toast({
      title: "Scan Started",
      description: "Security scan has started. Report will appear soon."
    });

  } catch (err) {

    setIsScanning(false);

    toast({
      title: "Scan Failed",
      description: "Could not start scanner.",
      variant: "destructive"
    });

  }

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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !user ? (
            <div className="max-w-xl mx-auto">
              <div className="rounded-2xl bg-card border border-border p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Login Required</h3>
                <p className="text-muted-foreground mb-6">
                  To use our security testing tools, please sign in or create an account first.
                </p>
                <Link to="/auth">
                  <Button variant="hero" size="lg">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In / Register
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
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
                    placeholder="Your Name"
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
                    placeholder="+91 9123456789"
                    value={scannerPhone}
                    onChange={(e) => setScannerPhone(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
              </div>

              {/* Swipeable Tier Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Scan Tier — Swipe or use arrows</Label>
                <div 
                  className="relative"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* Left Arrow */}
                  <button
                    onClick={goPrev}
                    disabled={currentTierIndex === 0}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Tier Card */}
                  <div className="overflow-hidden rounded-2xl border-2 border-primary bg-card transition-all duration-300">
                    <div className="p-6 relative">
                      {selectedTier.comingSoon && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl">
                          <Clock className="w-12 h-12 text-primary mb-3 animate-pulse" />
                          <span className="text-xl font-bold text-foreground">Coming Soon</span>
                          <p className="text-sm text-muted-foreground mt-1">This tier is under development</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold">{selectedTier.name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedTier.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-primary font-bold text-xl">
                            <Coins className="w-5 h-5" />
                            {selectedTier.price.toLocaleString()}
                          </div>
                          <span className="text-xs text-muted-foreground">coins</span>
                        </div>
                      </div>

                      {selectedTier.requiresApproval && (
                        <Badge variant="secondary" className="mb-4">
                          <Lock className="w-3 h-3 mr-1" />
                          Approval Required
                        </Badge>
                      )}

                      {/* Test List */}
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tests Performed</h4>
                        <div className="grid gap-2">
                          {selectedTier.tests.map((test) => (
                            <div key={test.name} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="text-sm font-medium">{test.name}</div>
                                <div className="text-xs text-muted-foreground">{test.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={goNext}
                    disabled={currentTierIndex === scanTiers.length - 1}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Dots Indicator */}
                <div className="flex items-center justify-center gap-2 mt-3">
                  {scanTiers.map((tier, i) => (
                    <button
                      key={tier.id}
                      onClick={() => setCurrentTierIndex(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        i === currentTierIndex ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                    />
                  ))}
                </div>

                {balance && (
                  <p className="text-sm text-muted-foreground text-center">
                    Your balance: <span className="font-semibold text-foreground">{balance.balance} coins</span>
                    {!selectedTier.comingSoon && balance.balance < selectedTier.price && (
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
                  disabled={
                    isScanning || !url || !scannerName.trim() || selectedTier.comingSoon ||
                    (balance ? balance.balance < selectedTier.price : true)
                  }
                  className="sm:w-auto"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : selectedTier.comingSoon ? (
                    <>
                      <Clock className="w-4 h-4" />
                      Coming Soon
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

              {/* Note */}
              {   /*    <div className="p-4 rounded-lg bg-secondary/50 border border-border text-left">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> The security engine is already developed and is being 
                    deployed on AWS / Azure. It will be connected securely with the website frontend for real-time testing.
                  </p>
                </div>
              </div> 
        */}
            </div>
          )}
        </div>
      </section>

      {/* Result Display */}
      {showResult && (
        <section className="section-container pt-0">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl bg-card border border-border p-6 md:p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-xl font-bold mb-3">Request Submitted Successfully!</h3>
              <p className="text-muted-foreground mb-2">
                Your website URL <strong className="text-foreground">{url}</strong> has been submitted for security analysis.
              </p>
              <p className="text-muted-foreground mb-6">
                Our security team will review it and send you a detailed report via Google Drive link.
                You can check the status anytime in your <Link to="/profile" className="text-primary underline">Profile → Security Reports</Link>.
              </p>
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                  <Info className="w-4 h-4 text-primary" />
                  <span>You will be notified once the report is ready.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* What AlphaG1 Tests */}
      <section className="section-container bg-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">
            🔐 What Does <span className="gradient-text">AlphaG1</span> Test?
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Based on our proprietary Python security engine, AlphaG1 performs these automated checks on any website:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {scanTiers[0].tests.map((test) => (
              <div key={test.name} className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">{test.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{test.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Output */}
      <section className="section-container">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
            Output Provided
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {outputs.map((output) => (
              <div key={output.text} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                <output.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground text-sm">{output.text}</span>
              </div>
            ))}
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
            <Link to="/contact" className="flex items-center gap-2">
              Request Advanced Audit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
