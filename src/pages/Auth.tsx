import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  Phone,
  User,
  UserPlus,
} from "lucide-react";
import { z } from "zod";
import GoogleLogin from "@/components/GoogleLogin";
import { ResetPasswordDialog } from "@/components/ResetPasswordDialog";

// --- Validation schemas ---
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const mounted = useRef(true);
  const authCompleted = useRef(false);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showPassword, setShowPassword] = useState(false);

  // Sign-up OTP state
  const [showSignupOtp, setShowSignupOtp] = useState(false);
  const [signupOtpCode, setSignupOtpCode] = useState("");
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [signupOtpTimer, setSignupOtpTimer] = useState(0);

  // Reset password dialog
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  // Login OTP dialog
  const [loginOtpOpen, setLoginOtpOpen] = useState(false);
  const [loginOtpEmail, setLoginOtpEmail] = useState("");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginOtpStep, setLoginOtpStep] = useState<"email" | "verify">("email");
  const [loginOtpTimer, setLoginOtpTimer] = useState(0);
  const [resetLoading, setResetLoading] = useState(false); // reused for OTP dialogs

  // --- Effects ---
  useEffect(() => {
    mounted.current = true;

    // Redirect if user already has a valid session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mounted.current) {
        navigate("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (authCompleted.current && session?.user && mounted.current) {
        navigate("/");
      }
    });
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (signupOtpTimer <= 0) return;
    const timer = setTimeout(() => setSignupOtpTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [signupOtpTimer]);

  useEffect(() => {
    if (loginOtpTimer <= 0) return;
    const timer = setTimeout(() => setLoginOtpTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [loginOtpTimer]);

  // --- Helper functions ---
  const normalizeOtp = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  const validateMainForm = useCallback(() => {
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
        const nextErrors: Record<string, string> = {};
        error.errors.forEach((issue) => {
          if (issue.path[0]) nextErrors[issue.path[0] as string] = issue.message;
        });
        setErrors(nextErrors);
      }
      return false;
    }
  }, [isLogin, email, password, fullName, phone]);

  // --- Login with email/password ---
  const handleSignIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateMainForm()) return;

      setLoading(true);
      authCompleted.current = true;

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        navigate("/");
      } catch (error: any) {
        authCompleted.current = false;
        if (!mounted.current) return;
        toast({
          title: "Sign In Failed",
          description: error?.message?.includes("Invalid login credentials")
            ? "Invalid email or password."
            : error?.message || "Unable to sign in.",
          variant: "destructive",
        });
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [email, password, navigate, toast, validateMainForm],
  );

  // --- Sign-up: send OTP ---
  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateMainForm()) return;

      setLoading(true);
      try {
        setPendingUser({
          email: email.trim(),
          password: password.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
        });

        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim() || null,
            },
          },
        });

        if (error) throw error;

        setSignupOtpCode("");
        setShowSignupOtp(true);
        setSignupOtpTimer(45);
        toast({
          title: "Verification Code Sent",
          description: `Enter the 6-digit code sent to ${email.trim()}`,
        });
      } catch (error: any) {
        if (!mounted.current) return;
        toast({
          title: "Sign Up Failed",
          description: error?.message || "Unable to send OTP.",
          variant: "destructive",
        });
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [email, fullName, password, phone, toast, validateMainForm],
  );

  // --- Verify sign-up OTP ---
  const handleVerifySignupOtp = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!pendingUser || signupOtpCode.length !== 6) return;

      setLoading(true);
      try {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email: pendingUser.email,
          token: signupOtpCode,
          type: "email",
        });
        if (otpError) throw otpError;

        if (pendingUser.password) {
          const { error: updateError } = await supabase.auth.updateUser({
            password: pendingUser.password,
          });
          if (updateError) {
            toast({
              title: "Account created",
              description: "Account verified but password setup failed. You can set password later.",
              variant: "destructive",
            });
          }
        }

        authCompleted.current = true;
        toast({
          title: "Account Created",
          description: "Your email is verified and account is ready.",
        });
        navigate("/");
      } catch (error: any) {
        if (!mounted.current) return;
        toast({
          title: "Verification Failed",
          description: error?.message || "Invalid or expired code.",
          variant: "destructive",
        });
        setSignupOtpCode("");
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [navigate, pendingUser, signupOtpCode, toast],
  );

  // --- Resend sign-up OTP ---
  const handleResendSignupOtp = useCallback(async () => {
    if (!pendingUser || signupOtpTimer > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: pendingUser.email,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: pendingUser.fullName,
            phone: pendingUser.phone || null,
          },
        },
      });
      if (error) throw error;

      setSignupOtpTimer(45);
      setSignupOtpCode("");
      toast({ title: "Code Resent", description: "A new verification code has been sent." });
    } catch (error: any) {
      if (!mounted.current) return;
      toast({ title: "Resend Failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [pendingUser, signupOtpTimer, toast]);

  // --- Login OTP flow ---
  const sendLoginOtp = useCallback(async () => {
    const targetEmail = loginOtpEmail.trim();
    try {
      z.string().email().parse(targetEmail);
    } catch {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      setLoginOtpStep("verify");
      setLoginOtpTimer(45);
      setLoginOtpCode("");
      toast({ title: "OTP Sent", description: "Enter the 6-digit code sent to your email." });
    } catch (error: any) {
      if (!mounted.current) return;
      toast({ title: "OTP Failed", description: error?.message || "Unable to send OTP.", variant: "destructive" });
    } finally {
      if (mounted.current) setResetLoading(false);
    }
  }, [loginOtpEmail, toast]);

  const verifyLoginOtp = useCallback(async () => {
    if (loginOtpCode.length !== 6 || !loginOtpEmail.trim()) return;

    setResetLoading(true);
    authCompleted.current = true;

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: loginOtpEmail.trim(),
        token: loginOtpCode,
        type: "email",
      });
      if (error) throw error;

      toast({ title: "Signed In", description: "OTP verification successful." });
      setLoginOtpOpen(false);
      navigate("/");
    } catch (error: any) {
      authCompleted.current = false;
      if (!mounted.current) return;
      toast({ title: "Verification Failed", description: error?.message || "Invalid OTP.", variant: "destructive" });
      setLoginOtpCode("");
    } finally {
      if (mounted.current) setResetLoading(false);
    }
  }, [loginOtpCode, loginOtpEmail, navigate, toast]);

  const openLoginOtpDialog = () => {
    setLoginOtpOpen(true);
    setLoginOtpStep("email");
    setLoginOtpEmail(email.trim());
    setLoginOtpCode("");
  };

  const switchMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setErrors({});
    setShowSignupOtp(false);
    setSignupOtpCode("");
    setPendingUser(null);
    setPassword("");
  }, []);

  // --- Sign-up OTP view ---
  if (showSignupOtp && pendingUser) {
    return (
      <Layout>
        <section className="section-container min-h-[80vh] flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-primary/10 border-primary/20 mb-6">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Verify Email</span>
              </div>
              <h1 className="text-3xl font-bold mb-4">
                Enter <span className="gradient-text">OTP</span>
              </h1>
              <p className="text-muted-foreground">
                We sent a 6-digit code to<br />
                <span className="font-medium text-foreground">{pendingUser.email}</span>
              </p>
            </div>

            <div className="p-8 rounded-2xl backdrop-blur-2xl border border-white/15 bg-white/5 space-y-6">
              <form onSubmit={handleVerifySignupOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-otp">Verification Code</Label>
                  <Input
                    id="signup-otp"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={signupOtpCode}
                    onChange={(e) => setSignupOtpCode(normalizeOtp(e.target.value))}
                    className="text-center text-lg tracking-[0.35em]"
                    maxLength={6}
                  />
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || signupOtpCode.length !== 6}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    <>Verify & Create Account</>
                  )}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={handleResendSignupOtp}
                  disabled={signupOtpTimer > 0}
                  className="text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {signupOtpTimer > 0 ? `Resend in ${signupOtpTimer}s` : "Resend Code"}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignupOtp(false);
                      setPendingUser(null);
                      setSignupOtpCode("");
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back to Sign Up
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  // --- Main Auth Form ---
  return (
    <Layout>
      <section className="section-container min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 backdrop-blur-sm ${
                isLogin ? "bg-primary/10 border-primary/20" : "bg-accent/10 border-accent/20"
              }`}
            >
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
              {isLogin ? (
                <>
                  Sign <span className="gradient-text">In</span>
                </>
              ) : (
                <>
                  Create <span className="gradient-text">Account</span>
                </>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? "Enter your credentials to access your account"
                : "Create account with email OTP verification"}
            </p>
          </div>

          <div
            className={`p-8 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
              isLogin ? "bg-card/80 border-border" : "bg-gradient-to-b from-accent/5 to-card/80 border-accent/20"
            }`}
          >
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
                  Email <span className="text-destructive">*</span>
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
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Password {isLogin && <span className="text-destructive">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={isLogin}
                    minLength={isLogin ? 6 : undefined}
                    className={`bg-background/50 border-border/50 pr-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">
                    Password is required and will be set after email verification.
                  </p>
                )}
              </div>

              {isLogin && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordOpen(true)}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Forgot Password?
                  </button>

                  <button type="button" onClick={openLoginOtpDialog} className="text-sm text-accent hover:underline font-medium">
                    Login with OTP
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
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Send Signup OTP <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Google Login Button */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/30"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-center gap-2">
                <GoogleLogin />
                <Web3Login />
              </div>
            </div>

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

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
        initialEmail={email}
      />

      {/* Login OTP Dialog */}
      <Dialog
        open={loginOtpOpen}
        onOpenChange={(open) => {
          setLoginOtpOpen(open);
          if (!open) {
            setLoginOtpStep("email");
            setLoginOtpCode("");
            setLoginOtpTimer(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" />
              Login with OTP
            </DialogTitle>
            <DialogDescription>
              {loginOtpStep === "email"
                ? "Enter your registered email to receive a one-time code."
                : `Enter the 6-digit code sent to ${loginOtpEmail}`}
            </DialogDescription>
          </DialogHeader>

          {loginOtpStep === "email" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginOtpEmail">Email</Label>
                <Input
                  id="loginOtpEmail"
                  type="email"
                  value={loginOtpEmail}
                  onChange={(e) => setLoginOtpEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button className="w-full" onClick={sendLoginOtp} disabled={resetLoading || !loginOtpEmail.trim()}>
                {resetLoading ? "Sending..." : "Send OTP"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginOtpCode">Verification Code</Label>
                <Input
                  id="loginOtpCode"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit OTP"
                  value={loginOtpCode}
                  onChange={(e) => setLoginOtpCode(normalizeOtp(e.target.value))}
                  className="text-center text-lg tracking-[0.35em]"
                  maxLength={6}
                />
              </div>

              <button
                type="button"
                onClick={sendLoginOtp}
                disabled={loginOtpTimer > 0 || resetLoading}
                className="text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {loginOtpTimer > 0 ? `Resend in ${loginOtpTimer}s` : "Resend OTP"}
              </button>

              <Button className="w-full" onClick={verifyLoginOtp} disabled={resetLoading || loginOtpCode.length !== 6}>
                {resetLoading ? "Verifying..." : "Verify OTP & Login"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
                    }
