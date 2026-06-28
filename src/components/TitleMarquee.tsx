import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

interface TitleEvent {
  id: string;
  user_display_name: string | null;
  title_name: string;
  title_emoji: string;
  multiplier: number;
}

export function TitleMarquee() {
  const [events, setEvents] = useState<TitleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("user_titles")
        .select("id, user_display_name, title_name, title_emoji, multiplier")
        .order("claimed_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setEvents(data);
      }
      setLoading(false);
    };

    fetchEvents();

    // Subscribe to new claims
    const channel = supabase
      .channel("title_claims")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_titles",
        },
        () => {
          fetchEvents(); // Refetch on any change to keep it simple and fresh
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full flex justify-center py-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="w-full text-center py-4 text-sm text-muted-foreground/70">
        Be the first to claim a title!
      </div>
    );
  }

  // Duplicate events for seamless scrolling if there are few
  const displayEvents = events.length < 5 ? [...events, ...events, ...events, ...events] : [...events, ...events];

  return (
    <div className="w-full mt-6 bg-card/40 border-y border-border/40 py-3 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
      
      <div className="flex animate-marquee whitespace-nowrap items-center">
        {displayEvents.map((event, i) => (
          <div
            key={`${event.id}-${i}`}
            className="flex items-center gap-2 mx-6 text-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-foreground">
              {event.user_display_name || "A User"}
            </span>
            <span className="text-muted-foreground">claimed</span>
            <span className="font-bold flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {event.multiplier > 1 && `${event.multiplier}x`} {event.title_emoji} {event.title_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
