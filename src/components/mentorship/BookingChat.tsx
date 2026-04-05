import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Video, ExternalLink, CheckCheck, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BookingChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    mentor_name?: string;
    learner_name?: string;
    status: string;
    meeting_link: string | null;
    total_price: number;
    scheduled_at: string;
    topic_name?: string;
  } | null;
  currentUserId: string;
}

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  _optimistic?: boolean; // local-only flag for pending messages
}

const STORAGE_KEY = (bookingId: string) => `chat_messages_${bookingId}`;

function loadCachedMessages(bookingId: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(bookingId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedMessages(bookingId: string, messages: Message[]) {
  try {
    // Only cache confirmed (non-optimistic) messages, keep last 100
    const confirmed = messages.filter(m => !m._optimistic).slice(-100);
    localStorage.setItem(STORAGE_KEY(bookingId), JSON.stringify(confirmed));
  } catch {}
}

export function BookingChat({ open, onOpenChange, booking, currentUserId }: BookingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!booking || !open) return;

    // 1. Load cached messages from localStorage instantly
    const cached = loadCachedMessages(booking.id);
    if (cached.length > 0) setMessages(cached);

    // 2. Fetch from DB
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("booking_messages")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data);
        saveCachedMessages(booking.id, data);
      }
    };

    fetchMessages();

    // 3. Subscribe to realtime
    const channel = supabase
      .channel(`booking-chat-${booking.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_messages", filter: `booking_id=eq.${booking.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Replace optimistic message or skip duplicate
            const withoutOptimistic = prev.filter(
              m => !(m._optimistic && m.sender_id === newMsg.sender_id && m.message === newMsg.message)
            );
            if (withoutOptimistic.some(m => m.id === newMsg.id)) return withoutOptimistic;
            const updated = [...withoutOptimistic, newMsg];
            saveCachedMessages(booking.id, updated);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [booking?.id, open]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !booking) return;
    const text = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Optimistic: add message to UI immediately
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: currentUserId,
      message: text,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { error } = await supabase.from("booking_messages").insert({
      booking_id: booking.id,
      sender_id: currentUserId,
      message: text,
    });

    if (error) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(text); // restore the text
    }

    setSending(false);
  };

  if (!booking) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md p-0">
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <SheetHeader className="mb-2">
            <SheetTitle className="text-base">{booking.topic_name || "Booking Chat"}</SheetTitle>
            <SheetDescription className="text-xs">
              {booking.mentor_name || booking.learner_name} • {booking.total_price} coins
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
              {booking.status}
            </Badge>
            {booking.meeting_link && (
              <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                  <Video className="w-3 h-3" /> Join <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ minHeight: 0 }}>
          <div className="space-y-2">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No messages yet. Say hello! 👋</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                    <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                    <div className={`flex items-center gap-1 justify-end mt-0.5 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      <span className="text-[10px]">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                      {isMe && (
                        msg._optimistic
                          ? <Clock className="w-3 h-3" />
                          : <CheckCheck className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={scrollEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="flex gap-2 px-3 py-3 border-t border-border bg-background">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
            className="rounded-full"
          />
          <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()} className="rounded-full shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
