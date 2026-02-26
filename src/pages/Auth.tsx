import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, LogIn, Mail, Lock, ArrowRight, User, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Validation schemas
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100),
  phone: z.string().trim().min(10, "Phone must be at least 10 digits").max(15).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

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

  // ✅ Redirect only after session is confirmed
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session?.user) {
        navigate("/", { replace: true });
      }
    };

    initSession();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          navigate("/", { replace: true });
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const validateForm = () => {
    setErrors({});
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        registerSchema.parse({ fullName, phone, email, password });
      }
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const e: Record<string, string> = {};
        err.errors.forEach(er => e[er.path[0] as string] = er.message);
        setErrors(e);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Force session hydration
        await supabase.auth.getSession();

        toast({ title: "Welcome back!" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from("profiles").insert({
            user_id: data.user.id,
            full_name: fullName,
            phone: phone || null,
          });
        }

        toast({
          title: "Account created!",
          description: "Check your email to verify your account.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {isLogin
                ? "Sign in to access your account"
                : "Join us to get started"}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Register-only fields */}
              {!isLogin && (
                <>
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-sm text-red-500">{errors.fullName}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone (optional)
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 h-12 text-base"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-red-500">{errors.phone}</p>
                    )}
                  </div>
                </>
              )}

              {/* Email (always shown) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Password (always shown) */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
              >
                {loading ? (
                  "Please wait..."
                ) : isLogin ? (
                  <>
                    <LogIn className="mr-2 h-5 w-5" /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" /> Create Account
                  </>
                )}
              </Button>
            </form>

            {/* Toggle between Login and Register */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                {isLogin ? "Need an account?" : "Already have an account?"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
    }
