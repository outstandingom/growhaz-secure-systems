import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { 
  User, Shield, Package, LogOut, AlertTriangle,
  CheckCircle2, Clock, ExternalLink, FileText, Trash2,
  Phone, Mail, Edit3, Save, X, GraduationCap, Zap,
  Wallet, Link2, Loader2, Copy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { MentorProfileSection } from "@/components/profile/MentorProfileSection";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ReportViewer } from "@/components/reports/ReportViewer";
import AlphaG2Report from "@/components/reports/Alphag2report";
import { MyDocuments } from "@/components/profile/MyDocuments";
import { VerificationHistory } from "@/components/profile/VerificationHistory";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { sha256 } from "@/lib/blockchain";
import { USER_REGISTRY_ADDRESS, SEPOLIA_EXPLORER } from "@/lib/contractConfig";

interface Certificate {
  name: string;
  issuer: string;
  url?: string;
  date?: string;
}

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  leetcode_url: string | null;
  certificates: Certificate[];
  skills: string[];
  hourly_rate: number | null;
  bio: string | null;
  is_available_as_mentor: boolean;
  experience_years: number;
}

interface Purchase {
  id: string;
  service_name: string;
  service_type: string;
  price: number;
  status: string;
  purchased_at: string;
  expires_at: string | null;
}

interface SecurityReport {
  id: string;
  website_url: string;
  scan_type: string;
  risk_level: string;
  vulnerabilities_found: number;
  scanned_at: string;
  report_data: any;
  report_url?: string | null;
  report_status?: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "mentor" | "services" | "reports" | "documents" | "history">("profile");
  const [userId, setUserId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [showG2Report, setShowG2Report] = useState(false);
  const [registeringOnChain, setRegisteringOnChain] = useState(false);
  const [editProfession, setEditProfession] = useState("");
  const [editWork, setEditWork] = useState("");
  const [editAge, setEditAge] = useState<number | "">("");
  const [bcName, setBcName] = useState("");
  const [bcPhone, setBcPhone] = useState("");
  const [ipfsProfileData, setIpfsProfileData] = useState<any>(null);
  const [loadingIpfs, setLoadingIpfs] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    walletAddress,
    walletType,
    onChainUser,
    loadingOnChain,
    connectMetaMask,
    connectPhantom,
    disconnect,
    registerUserOnChain,
    updateUserOnChain,
    isConnecting,
    loginMethod,
  } = useWeb3Wallet();
  const [showBlockchainForm, setShowBlockchainForm] = useState(false);

  // Fetch IPFS profile when on-chain user is found
  useEffect(() => {
    if (onChainUser?.exists && onChainUser.ipfsCid) {
      setLoadingIpfs(true);
      fetch(`https://gateway.pinata.cloud/ipfs/${onChainUser.ipfsCid}`)
        .then(r => r.json())
        .then(data => setIpfsProfileData(data))
        .catch(() => setIpfsProfileData(null))
        .finally(() => setLoadingIpfs(false));
    } else {
      setIpfsProfileData(null);
    }
  }, [onChainUser]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
  };

  const handleRegisterOnChain = async () => {
    if (!walletAddress || !profile) return;
    if (!editProfession.trim()) {
      toast({ title: "Missing Field", description: "Please enter your profession/role", variant: "destructive" });
      return;
    }
    if (!editAge || editAge < 18) {
      toast({ title: "Invalid Age", description: "You must be at least 18 years old.", variant: "destructive" });
      return;
    }
    setRegisteringOnChain(true);
    try {
      // Step 1: Pin full profile data to IPFS via Pinata
      toast({ title: "Step 1/3 — Uploading to IPFS", description: "Pinning your full profile to decentralized storage..." });
      const finalName = bcName.trim() || profile.full_name;
      const finalPhone = bcPhone.trim() || profile.phone || "";
      const emailHash = userEmail ? await sha256(userEmail) : "";
      const phoneHash = finalPhone ? await sha256(finalPhone) : "";

      const profilePayload = {
        name: finalName,
        email: userEmail,
        emailHash,
        phone: finalPhone,
        phoneHash,
        profession: editProfession.trim(),
        work: editWork.trim(),
        age: editAge,
        skills: profile.skills || [],
        bio: profile.bio || "",
        wallet: walletAddress,
        walletType: walletType,
        github: profile.github_url || "",
        linkedin: profile.linkedin_url || "",
        registeredAt: new Date().toISOString(),
        version: 2,
      };
      const profileJson = JSON.stringify(profilePayload, null, 2);
      const base64 = btoa(unescape(encodeURIComponent(profileJson)));

      const { data: pin, error: pinErr } = await supabase.functions.invoke("pinata-upload", {
        body: {
          fileBase64: base64,
          fileName: `profile-${walletAddress.slice(0, 8)}.json`,
          mimeType: "application/json",
          metadata: { type: "user-profile", wallet: walletAddress },
        },
      });
      if (pinErr) throw pinErr;
      if (pin?.error) throw new Error(pin.error);
      const ipfsCid = pin.cid;

      // Step 2: Register or update on UserRegistry smart contract
      toast({ title: "Step 2/3 — Confirm in MetaMask", description: "Sign the blockchain transaction..." });
      let txHash: string;
      if (onChainUser?.exists) {
        txHash = await updateUserOnChain(
          ipfsCid, finalName, editProfession.trim(), phoneHash, editAge as number, emailHash
        );
      } else {
        txHash = await registerUserOnChain(
          ipfsCid, finalName, editProfession.trim(), phoneHash, editAge as number, emailHash
        );
      }

      // Step 3: Save registration metadata to Supabase (for search)
      const { error: dbError } = await supabase.from("blockchain_user_registrations").insert({
        transaction_hash: txHash,
        block_hash: "pending",
        block_number: 0,
        contract_address: USER_REGISTRY_ADDRESS,
        wallet_address: walletAddress,
        ipfs_cid: ipfsCid,
        user_name: finalName,
        profession: editProfession.trim(),
        phone_hash: phoneHash,
        event_type: onChainUser?.exists ? "ProfileUpdated" : "UserRegistered",
        on_chain_timestamp: Math.floor(Date.now() / 1000),
      });

      if (dbError) console.warn("Failed to save to Supabase:", dbError);

      // Step 4: Also update profiles table with blockchain references
      await supabase
        .from("profiles")
        .update({
          chain_wallet_address: walletAddress,
          chain_contract_address: USER_REGISTRY_ADDRESS,
          chain_tx_hash: txHash,
        })
        .eq("id", profile.id);

      setIpfsProfileData(profilePayload);
      toast({
        title: "✅ Blockchain Profile Created!",
        description: `TX: ${txHash.slice(0, 14)}... — Data on IPFS: ${ipfsCid.slice(0, 12)}...`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Registration Failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRegisteringOnChain(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    checkAuthAndFetchData();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/auth");
      return;
    }

    setUserEmail(session.user.email || "");
    setUserId(session.user.id);

    await Promise.all([
      fetchProfile(session.user.id),
      fetchPurchases(),
      fetchReports()
    ]);
    
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      const certificates = Array.isArray(data.certificates) 
        ? (data.certificates as unknown as Certificate[])
        : [];
      
      setProfile({
        ...data,
        certificates,
        skills: data.skills || [],
        is_available_as_mentor: data.is_available_as_mentor || false,
        experience_years: data.experience_years || 0,
      });
      setEditName(data.full_name);
      setEditPhone(data.phone || "");
    } else if (error && error.code === "PGRST116") {
      const { data: session } = await supabase.auth.getSession();
      const userEmail = session?.session?.user?.email || "";
      const defaultName = userEmail.split("@")[0] || "User";
      
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: defaultName,
          phone: null
        })
        .select()
        .single();

      if (!insertError && newProfile) {
        setProfile({
          ...newProfile,
          certificates: [],
          skills: newProfile.skills || [],
          is_available_as_mentor: newProfile.is_available_as_mentor || false,
          experience_years: newProfile.experience_years || 0,
        });
        setEditName(newProfile.full_name);
        setEditPhone(newProfile.phone || "");
      }
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditName(profile?.full_name || "");
      setEditPhone(profile?.phone || "");
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editName,
        phone: editPhone || null
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } else {
      setProfile({ ...profile, full_name: editName, phone: editPhone || null });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully.",
      });
    }
    setSaving(false);
  };

  const fetchPurchases = async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("purchased_at", { ascending: false });

    if (!error && data) {
      setPurchases(data);
    }
  };

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("security_reports")
      .select("*")
      .order("scanned_at", { ascending: false });

    if (!error && data) {
      setReports(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/");
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase
      .from("security_reports")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete report.",
        variant: "destructive",
      });
    } else {
      setReports(reports.filter(r => r.id !== id));
      toast({
        title: "Deleted",
        description: "Security report has been deleted.",
      });
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low": return "text-emerald-400";
      case "medium": return "text-amber-400";
      case "high": return "text-red-400";
      case "critical": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "expired": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "pending": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleViewReport = (report: SecurityReport) => {
    if (report.scan_type === "alpha-g2") {
      setSelectedReport(report);
      setShowG2Report(true);
    } else {
      setSelectedReport(report);
      setShowG2Report(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="section-container flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-container">
        <div className="max-w-5xl mx-auto">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {profile?.full_name || "User"}
                </h1>
                {profile?.phone && (
                  <p className="text-muted-foreground">{profile.phone}</p>
                )}
                {walletAddress && (
                  <div className="flex items-center gap-2 mt-1">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    <code className="text-xs text-primary font-mono">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </code>
                    <button onClick={() => copyToClipboard(walletAddress)} className="text-muted-foreground hover:text-primary">
                      <Copy className="w-3 h-3" />
                    </button>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                      {walletType === "metamask" ? "MetaMask" : "Phantom"}
                    </Badge>
                    {onChainUser?.exists && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        On-Chain ✓
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {walletAddress && (
                <Button variant="outline" size="sm" onClick={disconnect} className="text-xs">
                  <Link2 className="w-3 h-3 mr-1" /> Disconnect
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="w-fit">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          {/* Blockchain Profile Section */}
          {loadingOnChain && walletAddress ? (
            <div className="mb-8 p-4 rounded-xl border border-primary/20 bg-card/50 flex items-center justify-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Fetching blockchain profile...</span>
            </div>
          ) : loginMethod === "wallet" && walletAddress && !onChainUser?.exists ? (
            /* Wallet-login user not registered */
            <div className="mb-8 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-card to-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Complete Blockchain Registration</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Wallet <code className="text-primary">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</code> connected — register your profile on-chain
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Full Name</Label>
                  <Input value={bcName} onChange={(e) => setBcName(e.target.value)} placeholder={profile?.full_name || "Your name"} className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Phone</Label>
                  <Input value={bcPhone} onChange={(e) => setBcPhone(e.target.value)} placeholder={profile?.phone || "Your phone"} className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Profession *</Label>
                  <Input value={editProfession} onChange={(e) => setEditProfession(e.target.value)} placeholder="e.g. Developer" className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Work / About</Label>
                  <Input value={editWork} onChange={(e) => setEditWork(e.target.value)} placeholder="e.g. Full-stack dev" className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Age (18+) *</Label>
                  <Input type="number" min="18" max="120" value={editAge} onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 28" className="bg-background/50 text-sm h-8" />
                </div>
              </div>
              <Button variant="hero" size="sm" className="w-full mt-3" onClick={handleRegisterOnChain} disabled={registeringOnChain || !editProfession.trim() || !editAge}>
                {registeringOnChain ? (
                  <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Registering...</>
                ) : (
                  <><Link2 className="w-3 h-3 mr-1.5" /> Register on Blockchain</>
                )}
              </Button>
            </div>
          ) : loginMethod === "traditional" && !walletAddress && !onChainUser?.exists ? (
            !showBlockchainForm ? (
              <div className="mb-6 flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/40">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Want a blockchain profile?</span>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7 px-3 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setShowBlockchainForm(true)}>
                  <Link2 className="w-3 h-3 mr-1" /> Register on Blockchain
                </Button>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-card/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" /> Connect Wallet to Register
                  </h4>
                  <button onClick={() => setShowBlockchainForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Connect your MetaMask or Phantom wallet, then fill in your details to create an on-chain profile.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => connectMetaMask()} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wallet className="w-3 h-3 mr-1" />}
                    MetaMask
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => connectPhantom()} disabled={isConnecting}>
                    Phantom
                  </Button>
                </div>
              </div>
            )
          ) : loginMethod === "traditional" && walletAddress && !onChainUser?.exists ? (
            <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-card/50 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Wallet Connected
                </h4>
                <code className="text-[10px] text-primary font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</code>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Full Name</Label>
                  <Input value={bcName} onChange={(e) => setBcName(e.target.value)} placeholder={profile?.full_name || "Name"} className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Phone</Label>
                  <Input value={bcPhone} onChange={(e) => setBcPhone(e.target.value)} placeholder={profile?.phone || "Phone"} className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Profession *</Label>
                  <Input value={editProfession} onChange={(e) => setEditProfession(e.target.value)} placeholder="e.g. Developer" className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Work / About</Label>
                  <Input value={editWork} onChange={(e) => setEditWork(e.target.value)} placeholder="About you" className="bg-background/50 text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Age (18+) *</Label>
                  <Input type="number" min="18" max="120" value={editAge} onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 28" className="bg-background/50 text-sm h-8" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="hero" size="sm" className="flex-1" onClick={handleRegisterOnChain} disabled={registeringOnChain || !editProfession.trim() || !editAge}>
                  {registeringOnChain ? (
                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Registering...</>
                  ) : (
                    <><Link2 className="w-3 h-3 mr-1.5" /> Register on Blockchain</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { disconnect(); setShowBlockchainForm(false); }} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {/* On-chain profile viewer (when registered) */}
          {onChainUser?.exists && (
            <div className="mb-8 p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Your Blockchain Profile
                  </h2>
                  <div className="flex items-center gap-2">
                    <a href={`https://gateway.pinata.cloud/ipfs/${onChainUser.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> IPFS
                    </a>
                    <a href={`${SEPOLIA_EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Etherscan
                    </a>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mb-4">
                  <div className="p-3 rounded-xl bg-card/60 border border-border">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><User className="w-3 h-3" /> Name</span>
                    <p className="font-medium text-sm">{onChainUser.name}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border border-border">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Shield className="w-3 h-3" /> Profession</span>
                    <p className="font-medium text-sm">{onChainUser.profession}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border border-border">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1">Age</span>
                    <p className="font-medium text-sm">{onChainUser.age}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border border-border">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Registered</span>
                    <p className="font-medium text-sm">{new Date(onChainUser.registeredAt * 1000).toLocaleDateString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card/60 border border-border">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Wallet className="w-3 h-3" /> Wallet</span>
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs truncate">{walletAddress?.slice(0, 10)}...{walletAddress?.slice(-6)}</code>
                      <button onClick={() => copyToClipboard(walletAddress!)} className="text-muted-foreground hover:text-primary shrink-0"><Copy className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card/60 border border-border mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1 mb-1"><Link2 className="w-3 h-3" /> IPFS Content Identifier (CID)</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs break-all flex-1">{onChainUser.ipfsCid}</code>
                    <button onClick={() => copyToClipboard(onChainUser.ipfsCid)} className="text-muted-foreground hover:text-primary shrink-0"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>

                {loadingIpfs ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Fetching profile from IPFS...</span>
                  </div>
                ) : ipfsProfileData && (
                  <div className="p-4 rounded-xl bg-card/60 border border-border mb-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> Full Profile Data (from IPFS)
                    </h4>
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      {ipfsProfileData.name && <div><span className="text-xs text-muted-foreground">Name:</span> <span className="font-medium">{ipfsProfileData.name}</span></div>}
                      {ipfsProfileData.email && <div><span className="text-xs text-muted-foreground">Email:</span> <span className="font-medium">{ipfsProfileData.email}</span></div>}
                      {ipfsProfileData.phone && <div><span className="text-xs text-muted-foreground">Phone:</span> <span className="font-medium">{ipfsProfileData.phone}</span></div>}
                      {ipfsProfileData.profession && <div><span className="text-xs text-muted-foreground">Profession:</span> <span className="font-medium">{ipfsProfileData.profession}</span></div>}
                      {ipfsProfileData.age && <div><span className="text-xs text-muted-foreground">Age:</span> <span className="font-medium">{ipfsProfileData.age}</span></div>}
                      {ipfsProfileData.work && <div className="md:col-span-2"><span className="text-xs text-muted-foreground">Work/About:</span> <span className="font-medium">{ipfsProfileData.work}</span></div>}
                      {ipfsProfileData.github && <div><span className="text-xs text-muted-foreground">GitHub:</span> <a href={ipfsProfileData.github} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{ipfsProfileData.github}</a></div>}
                      {ipfsProfileData.linkedin && <div><span className="text-xs text-muted-foreground">LinkedIn:</span> <a href={ipfsProfileData.linkedin} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{ipfsProfileData.linkedin}</a></div>}
                      {ipfsProfileData.registeredAt && <div><span className="text-xs text-muted-foreground">Created:</span> <span className="font-medium">{new Date(ipfsProfileData.registeredAt).toLocaleString()}</span></div>}
                    </div>
                  </div>
                )}

                <div className="border-t border-border/30 pt-4">
                  <h4 className="text-sm font-semibold mb-3">Update Profile On-Chain</h4>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input value={bcName} onChange={(e) => setBcName(e.target.value)} placeholder={onChainUser.name} className="bg-background/50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input value={bcPhone} onChange={(e) => setBcPhone(e.target.value)} placeholder="Update phone" className="bg-background/50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Profession</Label>
                      <Input value={editProfession} onChange={(e) => setEditProfession(e.target.value)} placeholder={onChainUser.profession} className="bg-background/50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Work/About</Label>
                      <Input value={editWork} onChange={(e) => setEditWork(e.target.value)} placeholder="Your work" className="bg-background/50 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Age</Label>
                      <Input type="number" min="18" max="120" value={editAge} onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : "")} placeholder={onChainUser.age.toString()} className="bg-background/50 text-sm" />
                    </div>
                  </div>
                  <Button variant="hero" className="w-full mt-3" onClick={handleRegisterOnChain} disabled={registeringOnChain || !editProfession.trim() || !editAge}>
                    {registeringOnChain ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Update Blockchain Profile</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-border pb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "profile"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <User className="w-4 h-4" />
              My Profile
            </button>
            <button
              onClick={() => setActiveTab("mentor")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "mentor"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Mentor & Learner
            </button>
            <button
              onClick={() => setActiveTab("services")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "services"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Package className="w-4 h-4" />
              My Services
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "documents"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <FileText className="w-4 h-4" />
              My Documents
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Clock className="w-4 h-4" />
              Verification History
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "reports"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Shield className="w-4 h-4" />
              Security Reports
            </button>
          </div>

          {activeTab === "documents" && userId && <MyDocuments userId={userId} />}
          {activeTab === "history" && userId && <VerificationHistory userId={userId} />}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Personal Information</h2>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={handleEditToggle}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleEditToggle} disabled={saving}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button variant="hero" size="sm" onClick={handleSaveProfile} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      Full Name
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Enter your full name"
                        className="bg-background/50"
                      />
                    ) : (
                      <p className="text-lg font-medium py-2">
                        {profile?.full_name || "Not set"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Enter your phone number"
                        className="bg-background/50"
                      />
                    ) : (
                      <p className="text-lg font-medium py-2">
                        {profile?.phone || "Not set"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </Label>
                    <p className="text-lg font-medium py-2 text-muted-foreground">
                      {userEmail}
                      <span className="text-xs ml-2 px-2 py-1 bg-secondary rounded-full">
                        Cannot be changed
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border text-center">
                  <Package className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{purchases.length}</p>
                  <p className="text-sm text-muted-foreground">Services Purchased</p>
                </div>
                <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border text-center">
                  <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{reports.length}</p>
                  <p className="text-sm text-muted-foreground">Security Reports</p>
                </div>
                <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold">
                    {purchases.filter(p => p.status === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Services</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "mentor" && profile && (
            <MentorProfileSection
              profileId={profile.id}
              mentorData={{
                github_url: profile.github_url,
                linkedin_url: profile.linkedin_url,
                leetcode_url: profile.leetcode_url,
                certificates: profile.certificates,
                skills: profile.skills,
                hourly_rate: profile.hourly_rate,
                bio: profile.bio,
                is_available_as_mentor: profile.is_available_as_mentor,
                experience_years: profile.experience_years,
              }}
              onUpdate={(data) => setProfile({ ...profile, ...data })}
            />
          )}

          {activeTab === "services" && (
            <div className="space-y-4">
              {purchases.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No services yet</h3>
                  <p className="text-muted-foreground mb-6">
                    You haven't purchased any services yet.
                  </p>
                  <Button variant="hero" onClick={() => navigate("/pricing")}>
                    Browse Services
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border card-hover"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Package className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{purchase.service_name}</h3>
                            <p className="text-sm text-muted-foreground">{purchase.service_type}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              Purchased {format(new Date(purchase.purchased_at), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xl font-bold">₹{purchase.price.toLocaleString()}</span>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(purchase.status)}`}>
                            {purchase.status.toUpperCase()}
                          </span>
                          {purchase.expires_at && (
                            <span className="text-xs text-muted-foreground">
                              Expires: {format(new Date(purchase.expires_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No security reports</h3>
                  <p className="text-muted-foreground mb-6">
                    Run a security scan to see your reports here.
                  </p>
                  <Button variant="hero" onClick={() => navigate("/security-tools")}>
                    Run Security Scan
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            report.report_status === 'completed' ? 
                              (report.scan_type === "alpha-g2" ? "bg-purple-500/10" : "bg-emerald-500/10") :
                              "bg-amber-500/10"
                          }`}>
                            {report.report_status === 'completed' ? (
                              report.scan_type === "alpha-g2" ? (
                                <Zap className="w-6 h-6 text-purple-400" />
                              ) : (
                                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                              )
                            ) : (
                              <Clock className="w-6 h-6 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold break-all">{report.website_url}</h3>
                              <a 
                                href={report.website_url.startsWith('http') ? report.website_url : `https://${report.website_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                            <p className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                              {report.scan_type === "alpha-g2" ? (
                                <>
                                  <Zap className="w-3 h-3 text-purple-400" />
                                  AlphaG2 Professional Scan
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3 text-primary" />
                                  AlphaG1 Basic Scan
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {report.report_status === 'completed' ? (
                                <Badge className={report.scan_type === "alpha-g2" ? 
                                  "bg-purple-500/20 text-purple-400 border-purple-500/30" : 
                                  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                }>
                                  Report Ready
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  <Clock className="w-3 h-3 mr-1" /> Waiting for Report
                                </Badge>
                              )}
                              {report.scan_type === "alpha-g2" && report.report_status === 'completed' && (
                                <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                                  CVSS Scored
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Submitted {format(new Date(report.scanned_at), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {report.report_status === 'completed' ? (
                            <Button 
                              variant="hero" 
                              size="sm" 
                              className={`gap-1 ${report.scan_type === "alpha-g2" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                              onClick={() => handleViewReport(report)}
                            >
                              <FileText className="w-4 h-4" />
                              View Report
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="gap-1">
                              <Clock className="w-4 h-4" />
                              Pending
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteReport(report.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Report Viewer Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => {
        setSelectedReport(null);
        setShowG2Report(false);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Security Report</DialogTitle>
          {selectedReport && showG2Report ? (
            <AlphaG2Report 
              report={{
                base_url: selectedReport.website_url,
                test_run_id: selectedReport.id,
                timestamp: selectedReport.scanned_at,
                vulnerabilities: selectedReport.report_data?.vulnerabilities || [],
                test_summary: selectedReport.report_data?.test_summary || {},
                summary: {
                  total_vulnerabilities: selectedReport.vulnerabilities_found,
                  risk_level: selectedReport.risk_level as 'low' | 'medium' | 'high',
                  scan_completed: true,
                  blocked_tests: selectedReport.report_data?.summary?.blocked_tests || 0
                }
              }}
              onExport={() => {
                const dataStr = JSON.stringify(selectedReport.report_data, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const exportFileDefaultName = `security-report-${selectedReport.id}.json`;
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
              }}
              onShare={() => {
                toast({
                  title: "Share Report",
                  description: "Report sharing feature coming soon!",
                });
              }}
            />
          ) : selectedReport && !showG2Report ? (
            <ReportViewer 
              report={selectedReport} 
              onClose={() => {
                setSelectedReport(null);
                setShowG2Report(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}