import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Video, ExternalLink } from "lucide-react";
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
}

export function BookingChat({ open, onOpenChange, booking, currentUserId }: BookingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!booking || !open) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("booking_messages")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase
      .channel(`booking-chat-${booking.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_messages", filter: `booking_id=eq.${booking.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [booking?.id, open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !booking) return;
    setSending(true);
    const { error } = await supabase.from("booking_messages").insert({
      booking_id: booking.id,
      sender_id: currentUserId,
      message: newMessage.trim(),
    });
    if (!error) setNewMessage("");
    setSending(false);
  };

  if (!booking) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg">Booking Chat</SheetTitle>
          <SheetDescription className="text-xs">
            {booking.topic_name} • {booking.total_price} coins
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mb-2">
          <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "destructive" : "secondary"}>
            {booking.status}
          </Badge>
          {booking.meeting_link && (
            <a href={booking.meeting_link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                <Video className="w-3 h-3" /> Join Meeting <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          )}
        </div>

        <ScrollArea className="flex-1 pr-3" ref={scrollRef as any}>
          <div className="space-y-3 py-2">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation!</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p>{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t border-border">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
