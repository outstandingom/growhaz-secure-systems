import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { z } from "zod";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mounted = useRef(true);

  const [step, setStep] = useState<"email" | "otp" | "newPassword">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const timer = setTimeout(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpTimer]);

  const normalizeOtp = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  const sendOtp = useCallback(async () => {
    // Validate email
    try {
      z.string().email().parse(email);
    } catch {
      setErrors({ email: "Please enter a valid email address." });
      return;
    }

    setLoading(true);
    try {
      // Send OTP – use shouldCreateUser: false because user should already exist
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });

      if (error) {
        if (error.message.includes("User not found")) {
          throw new Error("No account found with this email.");
        }
        throw error;
      }

      setStep("otp");
      setOtpTimer(45);
      toast({
        title: "Verification Code Sent",
        description: `Enter the 6-digit code sent to ${email}`,
      });
    } catch (error: any) {
      if (!mounted.current) return;
      toast({
        title: "Failed",
        description: error?.message || "Unable to send OTP.",
        variant: "destructive",
      });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [email, toast]);

  const verifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: "Please enter the 6-digit code." });
      return;
    }

    setLoading(true);
    try {
      // Verify OTP – this will sign the user in temporarily
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: "email",
      });

      if (error) throw error;

      // OTP verified – move to password reset step
      setStep("newPassword");
      toast({ title: "Verified", description: "You can now set a new password." });
    } catch (error: any) {
      if (!mounted.current) return;
      toast({
        title: "Verification Failed",
        description: error?.message || "Invalid or expired code.",
        variant: "destructive",
      });
      setOtpCode("");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [email, otpCode, toast]);

  const resetPassword = useCallback(async () => {
    // Validate passwords
    if (newPassword.length < 6) {
      setErrors({ newPassword: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      // Update password – user is already authenticated after OTP verification
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Successful",
        description: "You can now log in with your new password.",
      });
      navigate("/auth");
    } catch (error: any) {
      if (!mounted.current) return;
      toast({
        title: "Reset Failed",
        description: error?.message || "Unable to update password.",
        variant: "destructive",
      });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [newPassword, confirmPassword, navigate, toast]);

  const resendOtp = useCallback(async () => {
    if (otpTimer > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      setOtpTimer(45);
      setOtpCode("");
      toast({ title: "Code Resent", description: "A new code has been sent." });
    } catch (error: any) {
      if (!mounted.current) return;
      toast({ title: "Resend Failed", description: error?.message, variant: "destructive" });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [email, otpTimer, toast]);

  const goBack = () => {
    if (step === "otp") {
      setStep("email");
      setOtpCode("");
    } else if (step === "newPassword") {
      setStep("otp");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      navigate("/auth");
    }
  };

  // Render step views
  const renderEmailStep = () => (
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-primary/10 border-primary/20 mb-6">
          <KeyRound className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Reset Password</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">
          Reset <span className="gradient-text">Password</span>
        </h1>
        <p className="text-muted-foreground">Enter your email to receive a verification code.</p>
      </div>

      <div className="p-8 rounded-2xl backdrop-blur-xl border bg-card/80 border-border space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendOtp();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`bg-background/50 border-border/50 ${errors.email ? "border-destructive" : ""}`}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              <>Send OTP <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </form>
      </div>
    </>
  );

  const renderOtpStep = () => (
    <>
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
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="p-8 rounded-2xl backdrop-blur-xl border bg-card/80 border-border space-y-6">
        <div className="space-y-2">
          <Label htmlFor="otp-code">Verification Code</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            value={otpCode}
            onChange={(e) => setOtpCode(normalizeOtp(e.target.value))}
            className="text-center text-lg tracking-[0.35em]"
            maxLength={6}
          />
          {errors.otp && <p className="text-xs text-destructive">{errors.otp}</p>}
        </div>

        <Button
          onClick={verifyOtp}
          variant="hero"
          size="lg"
          className="w-full"
          disabled={loading || otpCode.length !== 6}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Verifying...
            </span>
          ) : (
            "Verify OTP"
          )}
        </Button>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={resendOtp}
            disabled={otpTimer > 0}
            className="text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend Code"}
          </button>
        </div>
      </div>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-primary/10 border-primary/20 mb-6">
          <KeyRound className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Set New Password</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">
          Create <span className="gradient-text">New Password</span>
        </h1>
        <p className="text-muted-foreground">Your email has been verified. Choose a new password.</p>
      </div>

      <div className="p-8 rounded-2xl backdrop-blur-xl border bg-card/80 border-border space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            resetPassword();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`bg-background/50 border-border/50 pr-10 ${errors.newPassword ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`bg-background/50 border-border/50 ${errors.confirmPassword ? "border-destructive" : ""}`}
            />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Updating...
              </span>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <Layout>
      <section className="section-container min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          {step === "email" && renderEmailStep()}
          {step === "otp" && renderOtpStep()}
          {step === "newPassword" && renderNewPasswordStep()}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
        }
