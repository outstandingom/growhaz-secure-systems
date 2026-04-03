import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookingChat } from "./BookingChat";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Video,
  Link as LinkIcon,
  Coins,
  Clock,
  BookOpen,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Booking {
  id: string;
  user_id: string;
  mentor_id: string;
  topic_id: string;
  status: string;
  total_price: number;
  meeting_link: string | null;
  scheduled_at: string;
  created_at: string;
  notes: string | null;
  mentor_name?: string;
  learner_name?: string;
  topic_name?: string;
}

export function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState<Record<string, string>>({});
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("mentorship_bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) { setLoading(false); return; }

    // Gather unique mentor/user/topic IDs to resolve names
    const mentorIds = [...new Set(data.map(b => b.mentor_id))];
    const userIds = [...new Set(data.map(b => b.user_id))];
    const topicIds = [...new Set(data.map(b => b.topic_id))];

    const [mentorsRes, profilesRes, topicsRes] = await Promise.all([
      supabase.from("mentors").select("id, name").in("id", mentorIds),
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
      supabase.from("mentorship_topics").select("id, name").in("id", topicIds),
    ]);

    // Also check community mentors (profiles acting as mentors) - mentor_id is user_id
    const communityRes = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", mentorIds);

    const mentorMap: Record<string, string> = {};
    mentorsRes.data?.forEach(m => { mentorMap[m.id] = m.name; });
    communityRes.data?.forEach(p => { if (!mentorMap[p.user_id]) mentorMap[p.user_id] = p.full_name; });

    const profileMap: Record<string, string> = {};
    profilesRes.data?.forEach(p => { profileMap[p.user_id] = p.full_name; });

    const topicMap: Record<string, string> = {};
    topicsRes.data?.forEach(t => { topicMap[t.id] = t.name; });

    const enriched = data.map(b => ({
      ...b,
      mentor_name: mentorMap[b.mentor_id] || "Mentor",
      learner_name: profileMap[b.user_id] || "Learner",
      topic_name: topicMap[b.topic_id] || "Session",
    }));

    setBookings(enriched);
    setLoading(false);
  };

  const handleAccept = async (bookingId: string) => {
    const link = meetingLinkInput[bookingId]?.trim();
    if (!link) {
      toast({ title: "Meeting link required", description: "Please paste a meeting link before accepting.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("mentorship_bookings")
      .update({ status: "confirmed", meeting_link: link })
      .eq("id", bookingId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking accepted!", description: "The learner can now see the meeting link." });
      fetchBookings();
    }
  };

  const handleDecline = async (bookingId: string, learnerId: string, amount: number) => {
    // Update booking status
    const { error } = await supabase
      .from("mentorship_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Refund coins via RPC
    const { error: refundError } = await supabase.rpc("update_coin_balance", {
      p_user_id: learnerId,
      p_amount: amount,
      p_type: "refund" as any,
      p_description: `Refund: mentor declined booking`,
    });

    if (refundError) {
      toast({ title: "Refund failed", description: refundError.message, variant: "destructive" });
    } else {
      toast({ title: "Booking declined", description: "Coins have been refunded to the learner." });
    }
    fetchBookings();
  };

  const openChat = (booking: Booking) => {
    setChatBooking(booking);
    setChatOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
          <p className="text-muted-foreground mb-4">Please sign in to view your bookings</p>
          <Button asChild><Link to="/auth">Sign In</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Bookings Yet</h3>
          <p className="text-muted-foreground">Book a mentor or wait for learners to book you.</p>
        </CardContent>
      </Card>
    );
  }

  const myBookingsAsLearner = bookings.filter(b => b.user_id === currentUserId);
  const myBookingsAsMentor = bookings.filter(b => b.mentor_id === currentUserId);

  const statusIcon = (status: string) => {
    if (status === "confirmed") return <CheckCircle2 className="w-3 h-3" />;
    if (status === "cancelled") return <XCircle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  const statusVariant = (status: string) => {
    if (status === "confirmed") return "default" as const;
    if (status === "cancelled") return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <>
      {myBookingsAsMentor.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Incoming Requests (as Mentor)
          </h3>
          <div className="space-y-4">
            {myBookingsAsMentor.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{b.learner_name} wants a session</CardTitle>
                    <Badge variant={statusVariant(b.status)} className="gap-1">
                      {statusIcon(b.status)} {b.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {b.topic_name} • {b.total_price} coins • {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {b.notes && <p className="text-sm text-muted-foreground mb-3">{b.notes}</p>}

                  {b.status === "pending" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste meeting link (Google Meet, Zoom...)"
                          value={meetingLinkInput[b.id] || ""}
                          onChange={(e) => setMeetingLinkInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAccept(b.id)} className="gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Accept & Send Link
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDecline(b.id, b.user_id, b.total_price)} className="gap-1">
                          <XCircle className="w-3 h-3" /> Decline
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openChat(b)} className="gap-1">
                          <MessageSquare className="w-3 h-3" /> Chat
                        </Button>
                      </div>
                    </div>
                  )}

                  {b.status !== "pending" && (
                    <div className="flex gap-2">
                      {b.meeting_link && (
                        <a href={b.meeting_link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1">
                            <Video className="w-3 h-3" /> Meeting Link
                          </Button>
                        </a>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openChat(b)} className="gap-1">
                        <MessageSquare className="w-3 h-3" /> Chat
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {myBookingsAsLearner.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            My Booked Sessions (as Learner)
          </h3>
          <div className="space-y-4">
            {myBookingsAsLearner.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Session with {b.mentor_name}</CardTitle>
                    <Badge variant={statusVariant(b.status)} className="gap-1">
                      {statusIcon(b.status)} {b.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {b.topic_name} • {b.total_price} coins • {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {b.status === "pending" && (
                    <p className="text-sm text-muted-foreground mb-3">
                      Waiting for the mentor to accept and share a meeting link...
                    </p>
                  )}
                  {b.status === "cancelled" && (
                    <p className="text-sm text-destructive mb-3">
                      This booking was declined. Coins have been refunded.
                    </p>
                  )}
                  <div className="flex gap-2">
                    {b.meeting_link && (
                      <a href={b.meeting_link} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="gap-1">
                          <Video className="w-3 h-3" /> Join Meeting
                        </Button>
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openChat(b)} className="gap-1">
                      <MessageSquare className="w-3 h-3" /> Chat with Mentor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <BookingChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        booking={chatBooking}
        currentUserId={currentUserId}
      />
    </>
  );
}
