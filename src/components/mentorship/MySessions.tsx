import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookingChat } from "./BookingChat";
import { ProfileViewer } from "./ProfileViewer";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar, CheckCircle2, XCircle, MessageSquare, Video,
  Clock, BookOpen, User, Coins
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface LearningRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  skills: string[];
  created_at: string;
  budget_min: number | null;
  budget_max: number | null;
  requester_name?: string;
}

interface Response {
  id: string;
  request_id: string;
  responder_id: string;
  responder_name: string;
  message: string;
  status: string;
  proposed_rate: number | null;
  created_at: string;
}

export function MySessions() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myRequests, setMyRequests] = useState<LearningRequest[]>([]);
  const [myResponses, setMyResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState<Record<string, string>>({});

  // Chat state
  const [chatBooking, setChatBooking] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Profile viewer state
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    // Fetch bookings, requests, responses in parallel
    const [bookingsRes, requestsRes, responsesRes] = await Promise.all([
      supabase.from("mentorship_bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("learning_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("learning_request_responses").select("*").eq("responder_id", user.id).order("created_at", { ascending: false }),
    ]);

    // Enrich bookings
    if (bookingsRes.data && bookingsRes.data.length > 0) {
      const data = bookingsRes.data;
      const mentorIds = [...new Set(data.map(b => b.mentor_id))];
      const userIds = [...new Set(data.map(b => b.user_id))];
      const topicIds = [...new Set(data.map(b => b.topic_id))];

      const [mentorsRes, profilesRes, topicsRes, communityRes] = await Promise.all([
        supabase.from("mentors").select("id, name").in("id", mentorIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("mentorship_topics").select("id, name").in("id", topicIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", mentorIds),
      ]);

      const mentorMap: Record<string, string> = {};
      mentorsRes.data?.forEach(m => { mentorMap[m.id] = m.name; });
      communityRes.data?.forEach(p => { if (!mentorMap[p.user_id]) mentorMap[p.user_id] = p.full_name; });

      const profileMap: Record<string, string> = {};
      profilesRes.data?.forEach(p => { profileMap[p.user_id] = p.full_name; });

      const topicMap: Record<string, string> = {};
      topicsRes.data?.forEach(t => { topicMap[t.id] = t.name; });

      setBookings(data.map(b => ({
        ...b,
        mentor_name: mentorMap[b.mentor_id] || "Mentor",
        learner_name: profileMap[b.user_id] || "Learner",
        topic_name: topicMap[b.topic_id] || "Session",
      })));
    }

    if (requestsRes.data) setMyRequests(requestsRes.data);
    if (responsesRes.data) setMyResponses(responsesRes.data);
    setLoading(false);
  };

  const handleAccept = async (bookingId: string) => {
    const link = meetingLinkInput[bookingId]?.trim();
    if (!link) {
      toast({ title: "Meeting link required", description: "Please paste a meeting link before accepting.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("mentorship_bookings").update({ status: "confirmed", meeting_link: link }).eq("id", bookingId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking accepted!" });
      fetchAll();
    }
  };

  const handleDecline = async (bookingId: string, learnerId: string, amount: number) => {
    const { error } = await supabase.from("mentorship_bookings").update({ status: "cancelled" }).eq("id", bookingId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.rpc("update_coin_balance", {
      p_user_id: learnerId, p_amount: amount, p_type: "refund" as any,
      p_description: "Refund: mentor declined booking",
    });
    toast({ title: "Booking declined", description: "Coins refunded to the learner." });
    fetchAll();
  };

  const handleCloseRequest = async (requestId: string) => {
    const { error } = await supabase.from("learning_requests").update({ status: "cancelled" }).eq("id", requestId);
    if (!error) { toast({ title: "Request closed" }); fetchAll(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const openChat = (booking: Booking) => {
    setChatBooking(booking);
    setChatOpen(true);
  };

  const viewProfile = (userId: string) => {
    setProfileUserId(userId);
    setProfileOpen(true);
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
          <p className="text-muted-foreground mb-4">Please sign in to view your sessions</p>
          <Button asChild><Link to="/auth">Sign In</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const bookingsAsLearner = bookings.filter(b => b.user_id === currentUserId);
  const bookingsAsMentor = bookings.filter(b => b.mentor_id === currentUserId);

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

  const hasBookings = bookingsAsLearner.length > 0 || bookingsAsMentor.length > 0;
  const hasRequests = myRequests.length > 0;
  const hasResponses = myResponses.length > 0;

  return (
    <>
      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="bookings" className="text-xs sm:text-sm gap-1">
            <Calendar className="w-4 h-4 hidden sm:block" /> Bookings
            {hasBookings && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{bookingsAsLearner.length + bookingsAsMentor.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs sm:text-sm gap-1">
            <BookOpen className="w-4 h-4 hidden sm:block" /> My Requests
            {hasRequests && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{myRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="responses" className="text-xs sm:text-sm gap-1">
            <MessageSquare className="w-4 h-4 hidden sm:block" /> My Offers
            {hasResponses && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{myResponses.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          {!hasBookings ? (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bookings Yet</h3>
                <p className="text-muted-foreground">Book a mentor or wait for learners to book you.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Incoming as Mentor */}
              {bookingsAsMentor.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" /> Incoming Requests (as Mentor)
                  </h3>
                  <div className="space-y-3">
                    {bookingsAsMentor.map((b) => (
                      <Card key={b.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              <button onClick={() => viewProfile(b.user_id)} className="hover:text-primary hover:underline transition-colors">
                                {b.learner_name}
                              </button>
                              {" "}wants a session
                            </CardTitle>
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
                              <Input
                                placeholder="Paste meeting link (Google Meet, Zoom...)"
                                value={meetingLinkInput[b.id] || ""}
                                onChange={(e) => setMeetingLinkInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => handleAccept(b.id)} className="gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Accept
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
                            <div className="flex flex-wrap gap-2">
                              {b.meeting_link && (
                                <a href={b.meeting_link} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="gap-1"><Video className="w-3 h-3" /> Meeting</Button>
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

              {/* My Sessions as Learner */}
              {bookingsAsLearner.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" /> My Booked Sessions
                  </h3>
                  <div className="space-y-3">
                    {bookingsAsLearner.map((b) => (
                      <Card key={b.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Session with{" "}
                              <button onClick={() => viewProfile(b.mentor_id)} className="hover:text-primary hover:underline transition-colors">
                                {b.mentor_name}
                              </button>
                            </CardTitle>
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
                            <p className="text-sm text-muted-foreground mb-3">Waiting for mentor to accept...</p>
                          )}
                          {b.status === "cancelled" && (
                            <p className="text-sm text-destructive mb-3">Booking declined. Coins refunded.</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {b.meeting_link && (
                              <a href={b.meeting_link} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="gap-1"><Video className="w-3 h-3" /> Join Meeting</Button>
                              </a>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openChat(b)} className="gap-1">
                              <MessageSquare className="w-3 h-3" /> Chat
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => viewProfile(b.mentor_id)} className="gap-1">
                              <User className="w-3 h-3" /> Profile
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="requests">
          {!hasRequests ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Requests Yet</h3>
                <p className="text-muted-foreground">Post a learning request to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <Card key={req.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{req.title}</CardTitle>
                      <Badge variant={req.status === "open" ? "default" : "secondary"} className="gap-1">
                        {req.status === "open" ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {req.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      Posted {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      {req.budget_min != null && ` • ${req.budget_min}${req.budget_max ? `-${req.budget_max}` : ""} coins`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{req.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {req.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {req.status === "open" && (
                        <Button size="sm" variant="destructive" onClick={() => handleCloseRequest(req.id)} className="gap-1">
                          <XCircle className="w-3 h-3" /> Close
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Offers Tab */}
        <TabsContent value="responses">
          {!hasResponses ? (
            <Card className="text-center py-12">
              <CardContent>
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Offers Yet</h3>
                <p className="text-muted-foreground">Browse requests and offer to help others!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myResponses.map((res) => (
                <Card key={res.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base line-clamp-1">{res.message.substring(0, 60)}...</CardTitle>
                      <Badge variant="secondary">{res.status}</Badge>
                    </div>
                    <CardDescription>
                      Sent {formatDistanceToNow(new Date(res.created_at), { addSuffix: true })}
                      {res.proposed_rate && ` • ${res.proposed_rate} coins/hr`}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BookingChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        booking={chatBooking}
        currentUserId={currentUserId || ""}
      />

      <ProfileViewer
        open={profileOpen}
        onOpenChange={setProfileOpen}
        userId={profileUserId}
      />
    </>
  );
}
