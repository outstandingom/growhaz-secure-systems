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
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(15).optional().or(z.literal("")),
  email: z.string().trim().email(),
  password: z.string().min(6),
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

  // ✅ FIX: only redirect AFTER session is confirmed
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
      isLogin
        ? loginSchema.parse({ email, password })
        : registerSchema.parse({ fullName, phone, email, password });
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

        // ✅ FIX: force session hydration
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
  };

  return (
    <Layout>
      <section className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input value={email} onChange={e => setEmail(e.target.value)} />
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <Button disabled={loading} type="submit" className="w-full">
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
