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
import { MyApkBuilds } from "@/components/profile/MyApkBuilds";
import { MyForensicReports } from "@/components/profile/MyForensicReports";
import { Smartphone, FileSearch } from "lucide-react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { BlockchainRegistration } from "@/components/blockchain/BlockchainRegistration";

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
  const [activeTab, setActiveTab] = useState<"profile" | "mentor" | "services" | "reports" | "documents" | "history" | "apps" | "forensic">("profile");
  const [userId, setUserId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SecurityReport | null>(null);
  const [showG2Report, setShowG2Report] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Web3 wallet hook
  const {
    walletAddress,
    walletType,
    onChainUser,
    loadingOnChain,
    isConnecting,
    connectMetaMask,
    disconnect,
    registerOrUpdateOnChain,
    refreshOnChainProfile,
  } = useWeb3Wallet();

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
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

          {/* Blockchain Registration Component */}
          <BlockchainRegistration
            walletAddress={walletAddress}
            walletType={walletType}
            onChainUser={onChainUser}
            loadingOnChain={loadingOnChain}
            isConnecting={isConnecting}
            connectMetaMask={connectMetaMask}
            disconnect={disconnect}
            registerOrUpdateOnChain={registerOrUpdateOnChain}
            refreshOnChainProfile={refreshOnChainProfile}
            userEmail={userEmail}
            userProfile={profile}
          />

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
            <button
              onClick={() => setActiveTab("apps")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "apps"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              My Apps
            </button>
            <button
              onClick={() => setActiveTab("forensic")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "forensic"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <FileSearch className="w-4 h-4" />
              Forensic Reports
            </button>
          </div>

          {activeTab === "documents" && userId && <MyDocuments userId={userId} />}
          {activeTab === "history" && userId && <VerificationHistory userId={userId} />}
          {activeTab === "apps" && userId && <MyApkBuilds userId={userId} />}
          {activeTab === "forensic" && userId && <MyForensicReports userId={userId} />}

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
