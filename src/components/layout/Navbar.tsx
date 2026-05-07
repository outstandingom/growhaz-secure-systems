import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, Coins, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";

const navItems = [
  { label: "Security Tools", href: "/security-tools" },
  { label: "Blockchain", href: "/blockchain" },
  { label: "Automation", href: "/automation" },
  { label: "Learn & Mentorship", href: "/mentorship" },
  { label: "Blog", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch coin balance
          setTimeout(() => fetchCoinBalance(session.user.id), 0);
          setTimeout(() => checkAdminStatus(session.user.id), 0);
        } else {
          setCoinBalance(0);
          setIsAdmin(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCoinBalance(session.user.id);
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCoinBalance = async (userId: string) => {
    const { data } = await supabase
      .from('coin_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    setCoinBalance(data?.balance || 0);
  };

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    setIsAdmin(data === true);
  };

  // Subscribe to balance changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('navbar_balance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.balance !== undefined) {
            setCoinBalance(payload.new.balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-lg overflow-hidden">
              <img
                src="/favicon.png"
                alt="GROWHAZ Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-bold tracking-tight">
              GROW<span className="gradient-text">HAZ</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === item.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {user && (
              <>
                <Link to="/wallet">
                  <Button variant="outline" size="default" className="gap-2">
                    <Coins className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{coinBalance}</span>
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost" size="icon" title="Admin Dashboard">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </Button>
                  </Link>
                )}
              </>
            )}
            {user ? (
              <Link to="/profile">
                <Button variant="outline" size="default" className="gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button variant="outline" size="default">
                  Sign In
                </Button>
              </Link>
            )}
            <Link to="/contact">
              <Button variant="hero" size="default">
                Contact Us
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden bg-background border-b border-border">
          <div className="container mx-auto px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === item.href
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border space-y-2">
              {user && (
                <>
                  <Link to="/wallet" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full gap-2">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{coinBalance} Coins</span>
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Admin Dashboard
                      </Button>
                    </Link>
                  )}
                </>
              )}
              {user ? (
                <Link to="/profile" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="lg" className="w-full gap-2">
                    <User className="w-4 h-4" />
                    My Profile
                  </Button>
                </Link>
              ) : (
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="lg" className="w-full">
                    Sign In
                  </Button>
                </Link>
              )}
              <Link to="/contact" onClick={() => setIsOpen(false)}>
                <Button variant="hero" size="lg" className="w-full">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
