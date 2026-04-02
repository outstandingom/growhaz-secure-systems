import { useState, useCallback, useEffect, useRef } from "react";
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
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { z } from "zod";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  initialEmail = "",
}: ResetPasswordDialogProps) {
  const { toast } = useToast();
  const mounted = useRef(true);

  const [step, setStep] = useState<"email" | "otp" | "newPassword">("email");
  const [email, setEmail] = useState(initialEmail);
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

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to avoid state updates during render
      setTimeout(() => {
        setStep("email");
        setEmail(initialEmail);
        setOtpCode("");
        setNewPassword("");
        setConfirmPassword("");
        setErrors({});
        setOtpTimer(0);
      }, 200);
    }
  }, [open, initialEmail]);

  const normalizeOtp = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  const sendOtp = useCallback(async () => {
    try {
      z.string().email().parse(email);
    } catch {
      setErrors({ email: "Please enter a valid email address." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false }, // user must exist
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
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: "email",
      });

      if (error) throw error;

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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password Reset Successful",
        description: "You can now log in with your new password.",
      });
      onOpenChange(false);
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
  }, [newPassword, confirmPassword, toast, onOpenChange]);

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

  const handleBack = () => {
    if (step === "otp") {
      setStep("email");
      setOtpCode("");
    } else if (step === "newPassword") {
      setStep("otp");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {step === "email" && "Reset Password"}
            {step === "otp" && "Verify Email"}
            {step === "newPassword" && "Create New Password"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "Enter your email to receive a verification code."}
            {step === "otp" && `We sent a 6-digit code to ${email}`}
            {step === "newPassword" && "Your email has been verified. Choose a new password."}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <Button className="w-full" onClick={sendOtp} disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-otp">Verification Code</Label>
              <Input
                id="reset-otp"
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

            <button
              type="button"
              onClick={resendOtp}
              disabled={otpTimer > 0}
              className="text-sm text-primary font-medium hover:underline disabled:opacity-50"
            >
              {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend Code"}
            </button>

            <Button className="w-full" onClick={verifyOtp} disabled={loading || otpCode.length !== 6}>
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
          </div>
        )}

        {step === "newPassword" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={errors.newPassword ? "border-destructive pr-10" : "pr-10"}
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
                className={errors.confirmPassword ? "border-destructive" : ""}
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            <Button className="w-full" onClick={resetPassword} disabled={loading}>
              {loading ? "Updating..." : "Reset Password"}
            </Button>
          </div>
        )}

        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
  }
