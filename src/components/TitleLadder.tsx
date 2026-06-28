// src/components/TitleLadder.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());
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
          .select("title_key")
          .eq("user_id", session.user.id);

        if (!error && data) {
          setClaimedKeys(new Set(data.map((t: any) => t.title_key)));
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

      // Insert title
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase.from("user_titles").insert({
        user_id: session.user.id,
        title_key: tier.key,
        title_name: tier.name,
        title_emoji: tier.emoji,
        cost: tier.cost,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already Claimed", description: `You already have the ${tier.name} title!` });
        } else {
          throw error;
        }
      } else {
        setClaimedKeys((prev) => new Set([...prev, tier.key]));
        toast({
          title: `${tier.emoji} Title Claimed!`,
          description: `You are now a ${tier.name}!`,
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
  const highestClaimed = [...TITLE_TIERS].reverse().find((t) => claimedKeys.has(t.key));

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      {/* Toggle Banner */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-purple-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all group"
      >
        <Crown className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-purple-400 bg-clip-text text-transparent">
          {highestClaimed
            ? `${highestClaimed.emoji} ${highestClaimed.name} — Upgrade Your Title`
            : "🏆 Claim Your Title"}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Ladder */}
      {isExpanded && (
        <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-amber-500/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">Title Leaderboard</span>
              </div>
              {balance && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Coins className="w-3 h-3" />
                  {balance.balance} coins
                </Badge>
              )}
            </div>
          </div>

          {/* Title List */}
          <div className="divide-y divide-border/30 max-h-[360px] overflow-y-auto">
            {TITLE_TIERS.map((tier, index) => {
              const isClaimed = claimedKeys.has(tier.key);
              const isLoading = loadingClaim === tier.key;
              const canAfford = balance && balance.balance >= tier.cost;

              return (
                <div
                  key={tier.key}
                  className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                    isClaimed
                      ? "bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {/* Left: Rank + Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                      {index + 1}
                    </span>
                    <span className="text-lg flex-shrink-0">{tier.emoji}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isClaimed ? "text-primary" : ""}`}>
                        {tier.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {tier.cost.toLocaleString()} coins
                      </p>
                    </div>
                  </div>

                  {/* Right: Action */}
                  <div className="flex-shrink-0 ml-3">
                    {isClaimed ? (
                      <Badge variant="default" className="bg-green-500/90 text-white text-[10px] gap-1">
                        <Check className="w-3 h-3" />
                        Claimed
                      </Badge>
                    ) : isLoading ? (
                      <Button variant="ghost" size="sm" disabled className="h-7 px-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </Button>
                    ) : !isLoggedIn ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] gap-1"
                        onClick={() => navigate("/auth")}
                      >
                        <LogIn className="w-3 h-3" />
                        Login
                      </Button>
                    ) : !canAfford ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => navigate("/wallet")}
                      >
                        <Coins className="w-3 h-3" />
                        Add Coins
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-3 text-[10px] font-semibold"
                        onClick={() => handleClaim(tier)}
                      >
                        Claim
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {!isLoggedIn && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/30">
              <p className="text-xs text-center text-muted-foreground">
                <button onClick={() => navigate("/auth")} className="text-primary hover:underline">
                  Log in
                </button>{" "}
                to claim titles and appear on the leaderboard
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
