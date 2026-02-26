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

// Validation schemas (unchanged)
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

  // Session check with cleanup
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted && session?.user) {
        navigate("/", { replace: true });
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Force session refresh (optional but safe)
        await supabase.auth.getSession();

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        // Navigation is handled by onAuthStateChange
      } else {
        // REGISTER
        // 1. Sign up the user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              phone: phone || null,
            },
          },
        });

        if (error) throw error;
        if (!data.user) throw new Error("User creation failed");

        // 2. Wait a moment for the session to be established (especially if email confirmation is off)
        //    This ensures the user is authenticated before inserting profile.
        let retries = 0;
        const maxRetries = 5;
        let session = null;
        while (retries < maxRetries) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            session = sessionData.session;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms
          retries++;
        }

        // 3. Create profile (if session exists, otherwise the insert may be blocked by RLS)
        if (session) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: data.user.id,
              full_name: fullName,
              phone: phone || null,
            });

          if (profileError) {
            console.error("Profile creation error:", profileError);
            // Optionally show a warning but account is already created
            toast({
              title: "Account created, but profile setup failed",
              description: "Please contact support.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Account created!",
              description: "Please check your email to verify your account.",
            });
          }
        } else {
          // No session – email confirmation required
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account before logging in.",
          });
        }
      }
    } catch (error: any) {
      let errorMessage = error.message;
      // Improve common error messages
      if (error.message.includes("User already registered")) {
        errorMessage = "This email is already registered. Please log in instead.";
      } else if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.message.includes("Password should be")) {
        errorMessage = "Password must be at least 6 characters long.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Please verify your email before logging in.";
      }
      toast({
        title: "Error",
        description: errorMessage,
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
      {/* Added responsive padding and min-height for mobile */}
      <section className="section-container min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 backdrop-blur-sm ${
              isLogin 
                ? "bg-primary/10 border-primary/20" 
                : "bg-accent/10 border-accent/20"
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
              {isLogin ? (
                <>Sign <span className="gradient-text">In</span></>
              ) : (
                <>Create <span className="gradient-text">Account</span></>
              )}
            </h1>
            
            <p className="text-muted-foreground text-sm sm:text-base">
              {isLogin
                ? "Enter your credentials to access your account"
                : "Fill in your details to get started with GROWHAZ"}
            </p>
          </div>

          {/* Form Card */}
          <div className={`p-6 sm:p-8 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
            isLogin 
              ? "bg-card/80 border-border" 
              : "bg-gradient-to-b from-accent/5 to-card/80 border-accent/20"
          }`}>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name & Phone - Only for Register */}
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="flex items-center gap-2 text-sm sm:text-base">
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
                      className={`bg-background/50 border-border/50 backdrop-blur-sm h-12 text-base ${
                        errors.fullName ? "border-destructive" : ""
                      }`}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-destructive">{errors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-sm sm:text-base">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`bg-background/50 border-border/50 backdrop-blur-sm h-12 text-base ${
                        errors.phone ? "border-destructive" : ""
                      }`}
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>

                  <div className="border-t border-border/30 my-4" />
                </>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm sm:text-base">
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
                  className={`bg-background/50 border-border/50 backdrop-blur-sm h-12 text-base ${
                    errors.email ? "border-destructive" : ""
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm sm:text-base">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Password {!isLogin && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`bg-background/50 border-border/50 backdrop-blur-sm h-12 text-base ${
                    errors.password ? "border-destructive" : ""
                  }`}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
                {!isLogin && (
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full mt-6 h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : isLogin ? (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={switchMode}
                  className={`ml-2 font-medium hover:underline ${
                    isLogin ? "text-primary" : "text-accent"
                  }`}
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>

          {/* Info */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </Layout>
  );
        }
