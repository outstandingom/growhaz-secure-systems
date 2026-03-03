import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, LogIn, Mail, Lock, ArrowRight, User, Phone, Eye, EyeOff, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100),
  phone: z.string().trim().min(10, { message: "Please enter a valid phone number" }).max(15).optional().or(z.literal("")),
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

interface PendingUser {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // OTP Signup State
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPasswordOtp, setShowPasswordOtp] = useState(false);
  const [passwordOtpCode, setPasswordOtpCode] = useState("");
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const [passwordOtpResendTimer, setPasswordOtpResendTimer] = useState(0);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Track if user just completed auth (login/signup/otp verify)
  const [authCompleted, setAuthCompleted] = useState(false);

  useEffect(() => {
    // Sign out any existing session when Auth page loads
    // so users can login/signup with a different account
    let cancelled = false;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        await supabase.auth.signOut();
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only redirect if the user just completed an auth action on this page
        if (authCompleted && session?.user && !showNewPasswordForm && !showPasswordOtp) {
          navigate("/");
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate, showNewPasswordForm, showPasswordOtp, authCompleted]);

  // OTP resend countdown
  useEffect(() => {
    if (otpResendTimer > 0) {
      const timer = setTimeout(() => setOtpResendTimer(otpResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendTimer]);

  // Password OTP resend countdown
  useEffect(() => {
    if (passwordOtpResendTimer > 0) {
      const timer = setTimeout(() => setPasswordOtpResendTimer(passwordOtpResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [passwordOtpResendTimer]);

  // Auto-submit signup OTP
  useEffect(() => {
    if (otpCode.length === 6 && showOtpVerification && pendingUser) {
      handleVerifyOtp();
    }
  }, [otpCode]);

  // Auto-submit password OTP
  useEffect(() => {
    if (passwordOtpCode.length === 6 && showPasswordOtp) {
      handleVerifyPasswordOtp();
    }
  }, [passwordOtpCode]);

  const validateForm = () => {
    setErrors({});
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        registerSchema.parse({ fullName, phone, email, password });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // ========== SIGN IN ==========
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      setAuthCompleted(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthCompleted(false);
        throw error;
      }
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("Invalid login credentials")) msg = "Invalid email or password.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN UP WITH EMAIL OTP ==========
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      // Send OTP to email for verification
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: fullName,
            phone: phone,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast({ title: "OTP Failed", description: error.message, variant: "destructive" });
        return;
      }

      setPendingUser({ email, password, fullName, phone });
      setShowOtpVerification(true);
      setOtpResendTimer(60);
      toast({
        title: "Verification Code Sent",
        description: "Please check your email and enter the 6-digit code.",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ========== VERIFY SIGNUP OTP ==========
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpCode.length !== 6 || !pendingUser) return;

    setLoading(true);
    try {
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email: pendingUser.email,
        token: otpCode,
        type: "signup",
      });

      if (otpError) {
        toast({ title: "Verification Failed", description: otpError.message, variant: "destructive" });
        setOtpCode("");
        return;
      }

      // Set password after OTP verification
      const { error: updateError } = await supabase.auth.updateUser({
        password: pendingUser.password,
        data: {
          full_name: pendingUser.fullName,
          phone: pendingUser.phone,
        },
      });

      if (updateError) {
        toast({ title: "Account Update Failed", description: updateError.message, variant: "destructive" });
        setOtpCode("");
        return;
      }

      const userId = otpData?.session?.user?.id || otpData?.user?.id;

      if (userId) {
        // Create profile if not auto-created by trigger
        setTimeout(async () => {
          try {
            const { data: existing } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", userId)
              .single();

            if (!existing) {
              await supabase.from("profiles").insert({
                user_id: userId,
                full_name: pendingUser.fullName,
                phone: pendingUser.phone || null,
              });
            }
          } catch (err) {
            console.error("Profile fallback error:", err);
          }
        }, 100);
      }

      setAuthCompleted(true);
      toast({
        title: "Account Verified!",
        description: "Your account has been created successfully. Welcome to GROWHAZ!",
      });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
      setPendingUser(null);
      setOtpCode("");
      setShowOtpVerification(false);
    }
  };

  // ========== RESEND SIGNUP OTP ==========
  const handleResendOtp = async () => {
    if (otpResendTimer > 0 || !pendingUser) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: pendingUser.email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast({ title: "Resend Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Code Resent", description: "A new verification code has been sent." });
      setOtpResendTimer(60);
      setOtpCode("");
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ========== FORGOT PASSWORD: SEND OTP ==========
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const resetEmail = (forgotEmail || email).trim();
    if (!resetEmail) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: resetEmail,
        options: { shouldCreateUser: false },
      });

      if (error) {
        toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "OTP Sent", description: "Check your email for the 6-digit verification code." });
      setPasswordResetEmail(resetEmail);
      setShowPasswordOtp(true);
      setPasswordOtpResendTimer(60);
      setPasswordOtpCode("");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  // ========== VERIFY PASSWORD RESET OTP ==========
  const handleVerifyPasswordOtp = async () => {
    if (passwordOtpCode.length !== 6) return;

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: passwordResetEmail,
        token: passwordOtpCode,
        type: "recovery",
      });

      if (error) {
        toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
        setPasswordOtpCode("");
        return;
      }

      toast({ title: "Verified!", description: "Please set your new password." });
      setShowPasswordOtp(false);
      setShowNewPasswordForm(true);
      setPasswordOtpCode("");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      setPasswordOtpCode("");
    } finally {
      setResetLoading(false);
    }
  };

  // ========== RESEND PASSWORD OTP ==========
  const handleResendPasswordOtp = async () => {
    if (passwordOtpResendTimer > 0) return;
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: passwordResetEmail,
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast({ title: "Resend Failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Code Resent", description: "A new code has been sent to your email." });
      setPasswordOtpResendTimer(60);
      setPasswordOtpCode("");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  // ========== SET NEW PASSWORD ==========
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Password Updated!", description: "Please login with your new password." });
      await supabase.auth.signOut();
      closeForgotDialog();
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotDialog = () => {
    setForgotOpen(false);
    setForgotEmail("");
    setPasswordResetEmail("");
    setShowPasswordOtp(false);
    setShowNewPasswordForm(false);
    setPasswordOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFullName("");
    setPhone("");
    setShowOtpVerification(false);
    setOtpCode("");
    setPendingUser(null);
  };

  // ========== OTP VERIFICATION SCREEN (SIGNUP) ==========
  if (showOtpVerification && pendingUser) {
    return (
      <Layout>
        <section className="section-container min-h-[80vh] flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-primary/10 border-primary/20 mb-6">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Verify Email</span>
              </div>
              <h1 className="text-3xl font-bold mb-4">Enter <span className="gradient-text">OTP</span></h1>
              <p className="text-muted-foreground">
                We've sent a 6-digit verification code to<br />
                <span className="font-medium text-foreground">{pendingUser.email}</span>
              </p>
            </div>

            <div className="p-8 rounded-2xl backdrop-blur-xl border bg-card/80 border-border">
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || otpCode.length !== 6}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    <>Verify & Create Account</>
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={otpResendTimer > 0}
                      className="text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {otpResendTimer > 0 ? `Resend in ${otpResendTimer}s` : "Resend Code"}
                    </button>
                  </p>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setShowOtpVerification(false); setPendingUser(null); setOtpCode(""); }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back to Sign Up
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  // ========== MAIN AUTH FORM ==========
  return (
    <Layout>
      <section className="section-container min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 backdrop-blur-sm ${
              isLogin ? "bg-primary/10 border-primary/20" : "bg-accent/10 border-accent/20"
            }`}>
              {isLogin ? (
                <>
                  <LogIn className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Welcome Back</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-accent">Join GROWHAZ</span>
                </>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {isLogin ? <>Sign <span className="gradient-text">In</span></> : <>Create <span className="gradient-text">Account</span></>}
            </h1>
            <p className="text-muted-foreground">
              {isLogin ? "Enter your credentials to access your account" : "Fill in your details to get started with GROWHAZ"}
            </p>
          </div>

          <div className={`p-8 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
            isLogin ? "bg-card/80 border-border" : "bg-gradient-to-b from-accent/5 to-card/80 border-accent/20"
          }`}>
            <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-5">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className={`bg-background/50 border-border/50 ${errors.fullName ? "border-destructive" : ""}`}
                    />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`bg-background/50 border-border/50 ${errors.phone ? "border-destructive" : ""}`}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>
                  <div className="border-t border-border/30 my-4" />
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  Email {!isLogin && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`bg-background/50 border-border/50 ${errors.email ? "border-destructive" : ""}`}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Password {!isLogin && <span className="text-destructive">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={`bg-background/50 border-border/50 pr-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                {!isLogin && <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>}
              </div>

              {/* Forgot Password Link */}
              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button type="submit" variant="hero" size="lg" className="w-full mt-6" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {isLogin ? "Signing in..." : "Sending OTP..."}
                  </span>
                ) : isLogin ? (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Create Account <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={switchMode}
                  className={`ml-2 font-medium hover:underline ${isLogin ? "text-primary" : "text-accent"}`}
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>

      {/* ========== FORGOT PASSWORD DIALOG ========== */}
      <Dialog open={forgotOpen} onOpenChange={(open) => { if (!open) closeForgotDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {showNewPasswordForm ? "Set New Password" : showPasswordOtp ? "Verify OTP" : "Reset Password"}
            </DialogTitle>
            <DialogDescription>
              {showNewPasswordForm
                ? "Enter your new password below."
                : showPasswordOtp
                ? `Enter the 6-digit code sent to ${passwordResetEmail}`
                : "Enter your email to receive a verification code."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Enter email */}
          {!showPasswordOtp && !showNewPasswordForm && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail">Email Address</Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={resetLoading} className="w-full">
                  {resetLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending OTP...
                    </span>
                  ) : "Send OTP"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* Step 2: Enter OTP */}
          {showPasswordOtp && !showNewPasswordForm && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={passwordOtpCode} onChange={setPasswordOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendPasswordOtp}
                  disabled={passwordOtpResendTimer > 0}
                  className="text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {passwordOtpResendTimer > 0 ? `Resend in ${passwordOtpResendTimer}s` : "Resend Code"}
                </button>
              </div>
              <Button
                onClick={handleVerifyPasswordOtp}
                disabled={resetLoading || passwordOtpCode.length !== 6}
                className="w-full"
              >
                {resetLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : "Verify OTP"}
              </Button>
            </div>
          )}

          {/* Step 3: Set new password */}
          {showNewPasswordForm && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={resetLoading} className="w-full">
                  {resetLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : "Update Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
