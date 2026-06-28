import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSpendCoins } from "@/hooks/useSpendCoins";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Check,
  Coins,
  LogIn,
  Loader2,
  Crown,
} from "lucide-react";

export interface TitleTier {
  key: string;
  name: string;
  emoji: string;
  cost: number;
}

const TITLE_TIERS: TitleTier[] = [
  { key: "supporter",       name: "Supporter",        emoji: "🎗️",  cost: 10 },
  { key: "early_believer",  name: "Early Believer",   emoji: "🚀",  cost: 20 },
  { key: "growth_partner",  name: "Growth Partner",    emoji: "⭐",  cost: 50 },
  { key: "ninja",           name: "Ninja",             emoji: "🥷",  cost: 100 },
  { key: "hacker",          name: "Hacker",            emoji: "⚡",  cost: 200 },
  { key: "elite",           name: "Elite",             emoji: "💎",  cost: 500 },
  { key: "legend",          name: "Legend",             emoji: "👑",  cost: 1000 },
  { key: "visionary",       name: "Visionary",          emoji: "🌟",  cost: 2000 },
  { key: "titan",           name: "Titan",              emoji: "🚀",  cost: 5000 },
  { key: "mythic",          name: "Mythic",             emoji: "🌌",  cost: 10000 },
  { key: "immortal",        name: "Immortal",           emoji: "♾️",  cost: 20000 },
  { key: "founders_circle", name: "Founder's Circle",   emoji: "🏆",  cost: 50000 },
];

export function TitleLadder() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [claimedTitles, setClaimedTitles] = useState<Map<string, number>>(new Map());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingClaim, setLoadingClaim] = useState<string | null>(null);
  const [fetchingTitles, setFetchingTitles] = useState(false);
  const { spendCoins, balance } = useSpendCoins();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check auth & fetch claimed titles
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);

      if (session?.user) {
        setFetchingTitles(true);
        const { data, error } = await supabase
          .from("user_titles")
          .select("title_key, multiplier")
          .eq("user_id", session.user.id);

        if (!error && data) {
          const m = new Map();
          data.forEach((t: any) => m.set(t.title_key, t.multiplier || 1));
          setClaimedTitles(m);
        }
        setFetchingTitles(false);
      }
    };

    loadData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleClaim = async (tier: TitleTier) => {
    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }

    if (!balance || balance.balance < tier.cost) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${tier.cost} coins. Go to your wallet to add more.`,
        variant: "destructive",
      });
      navigate("/wallet");
      return;
    }

    setLoadingClaim(tier.key);
    try {
      // Deduct coins
      const success = await spendCoins(tier.cost, `Claimed title: ${tier.name}`);
      if (!success) {
        setLoadingClaim(null);
        return;
      }

      // Insert or Update title using RPC
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const displayName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "A User";

      const { error } = await supabase.rpc("claim_user_title", {
        p_user_id: session.user.id,
        p_title_key: tier.key,
        p_title_name: tier.name,
        p_title_emoji: tier.emoji,
        p_cost: tier.cost,
        p_display_name: displayName,
      });

      if (error) {
        throw error;
      } else {
        setClaimedTitles((prev) => {
          const next = new Map(prev);
          next.set(tier.key, (next.get(tier.key) || 0) + 1);
          return next;
        });
        
        toast({
          title: `${tier.emoji} Title Claimed!`,
          description: `You claimed ${tier.name}!`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to claim title",
        variant: "destructive",
      });
    } finally {
      setLoadingClaim(null);
    }
  };

  // Find user's highest title
  const highestClaimed = [...TITLE_TIERS].reverse().find((t) => claimedTitles.has(t.key));
  const highestMultiplier = highestClaimed ? claimedTitles.get(highestClaimed.key) : 0;

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      {/* Toggle Banner */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full relative group overflow-hidden rounded-2xl bg-card border border-border/40 p-4 transition-all hover:border-primary/50 shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
              {highestClaimed ? highestClaimed.emoji : "🏆"}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm">
                {highestClaimed ? (
                  <span className="flex items-center gap-1.5">
                    {highestMultiplier && highestMultiplier > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
                        {highestMultiplier}x
                      </span>
                    )}
                    {highestClaimed.name}
                  </span>
                ) : (
                  "Claim Your Title"
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                {highestClaimed
                  ? "Your highest active title"
                  : "Support the project & rank up"}
              </p>
            </div>
          </div>
          <div className="text-muted-foreground">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Ladder */}
      {isExpanded && (
        <div className="mt-2 rounded-2xl bg-card border border-border/40 shadow-xl overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-4 border-b border-border/40 bg-muted/30 flex justify-between items-center">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Title Ladder
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md border border-border/40">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              {balance ? balance.balance : 0}
            </div>
          </div>

          <div className="p-3 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
            {fetchingTitles ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              TITLE_TIERS.map((tier) => {
                const multiplier = claimedTitles.get(tier.key);
                const isClaimed = (multiplier || 0) > 0;
                const canAfford = balance && balance.balance >= tier.cost;
                const isHighest = highestClaimed?.key === tier.key;

                return (
                  <div
                    key={tier.key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isHighest
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : isClaimed
                        ? "border-border/60 bg-muted/20"
                        : "border-border/40 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                          isClaimed ? "bg-background shadow-sm" : "bg-muted opacity-60"
                        }`}
                      >
                        {tier.emoji}
                      </div>
                      <div>
                        <p className={`font-medium text-sm flex items-center gap-1.5 ${!isClaimed && "text-muted-foreground"}`}>
                          {tier.name}
                          {isHighest && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Coins className="w-3 h-3 text-amber-500/70" />
                          {tier.cost}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isClaimed && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          {multiplier! > 1 ? `${multiplier}x Claimed` : 'Claimed'}
                        </div>
                      )}
                      <button
                        onClick={() => handleClaim(tier)}
                        disabled={loadingClaim === tier.key || (!isLoggedIn && false)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                          !isLoggedIn
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : loadingClaim === tier.key
                            ? "bg-muted text-muted-foreground cursor-wait"
                            : isClaimed
                            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                            : canAfford
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {loadingClaim === tier.key ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : !isLoggedIn ? (
                          <>
                            <LogIn className="w-3.5 h-3.5" />
                            Login to claim
                          </>
                        ) : isClaimed ? (
                          "Claim Again"
                        ) : (
                          "Claim"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
