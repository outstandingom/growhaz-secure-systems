import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookingChat } from "./BookingChat";
import { ProfileViewer } from "./ProfileViewer";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar, CheckCircle2, XCircle, MessageSquare, Video,
  Clock, BookOpen, User, Coins, Star, ThumbsUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";

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

interface MySessionsProps {
  view?: "bookings" | "requests" | "responses";
}

export function MySessions({ view }: MySessionsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myRequests, setMyRequests] = useState<LearningRequest[]>([]);
  const [myResponses, setMyResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState<Record<string, string>>({});

  // Chat
  const [chatBooking, setChatBooking] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Profile viewer
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Review dialog
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewMentorId, setReviewMentorId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Track which bookings already have reviews
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const [bookingsRes, requestsRes, responsesRes, reviewsRes] = await Promise.all([
      supabase.from("mentorship_bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("learning_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("learning_request_responses").select("*").eq("responder_id", user.id).order("created_at", { ascending: false }),
      supabase.from("session_reviews").select("booking_id").eq("reviewer_id", user.id),
    ]);

    // Track reviewed bookings
    if (reviewsRes.data) {
      setReviewedBookings(new Set(reviewsRes.data.map((r: any) => r.booking_id)));
    }

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
      toast({ title: "Meeting link required", description: "Paste a meeting link before accepting.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("mentorship_bookings").update({ status: "confirmed", meeting_link: link }).eq("id", bookingId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Booking accepted!" }); fetchAll(); }
  };

  const handleDecline = async (bookingId: string, learnerId: string, amount: number) => {
    const { error } = await supabase.from("mentorship_bookings").update({ status: "cancelled" }).eq("id", bookingId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.rpc("update_coin_balance", {
      p_user_id: learnerId, p_amount: amount, p_type: "refund" as any,
      p_description: "Refund: mentor declined booking",
    });
    toast({ title: "Booking declined", description: "Coins refunded." });
    fetchAll();
  };

  const handleCloseRequest = async (requestId: string) => {
    const { error } = await supabase.from("learning_requests").update({ status: "cancelled" }).eq("id", requestId);
    if (!error) { toast({ title: "Request closed" }); fetchAll(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleSubmitReview = async () => {
    if (!reviewBookingId || !reviewMentorId || !currentUserId) return;
    setReviewSubmitting(true);

    const { error } = await supabase.from("session_reviews").insert({
      booking_id: reviewBookingId,
      reviewer_id: currentUserId,
      mentor_id: reviewMentorId,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
      session_completed: true,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Review submitted!", description: "Coins transferred to the mentor. Thank you!" });
      setReviewBookingId(null);
      setReviewText("");
      setReviewRating(5);
      fetchAll();
    }
    setReviewSubmitting(false);
  };

  const openChat = (booking: Booking) => { setChatBooking(booking); setChatOpen(true); };
  const viewProfile = (userId: string) => { setProfileUserId(userId); setProfileOpen(true); };

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
    if (status === "completed") return <ThumbsUp className="w-3 h-3" />;
    if (status === "cancelled") return <XCircle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };
  const statusVariant = (status: string) => {
    if (status === "confirmed") return "default" as const;
    if (status === "completed") return "default" as const;
    if (status === "cancelled") return "destructive" as const;
    return "secondary" as const;
  };

  const hasBookings = bookingsAsLearner.length > 0 || bookingsAsMentor.length > 0;
  const hasRequests = myRequests.length > 0;
  const hasResponses = myResponses.length > 0;

  const renderBookingCard = (b: Booking, role: "learner" | "mentor") => {
    const isMentor = role === "mentor";
    const otherName = isMentor ? b.learner_name : b.mentor_name;
    const otherUserId = isMentor ? b.user_id : b.mentor_id;
    const canReview = !isMentor && b.status === "confirmed" && !reviewedBookings.has(b.id);

    return (
      <Card key={b.id} className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              {isMentor ? (
                <><button onClick={() => viewProfile(otherUserId)} className="hover:text-primary hover:underline transition-colors">{otherName}</button> wants a session</>
              ) : (
                <>Session with <button onClick={() => viewProfile(otherUserId)} className="hover:text-primary hover:underline transition-colors">{otherName}</button></>
              )}
            </CardTitle>
            <Badge variant={statusVariant(b.status)} className="gap-1 shrink-0">
              {statusIcon(b.status)} {b.status}
            </Badge>
          </div>
          <CardDescription>
            {b.topic_name} • {b.total_price} coins • {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {b.notes && <p className="text-sm text-muted-foreground mb-3">{b.notes}</p>}

          {/* Mentor: pending actions */}
          {isMentor && b.status === "pending" && (
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

          {/* Learner: pending */}
          {!isMentor && b.status === "pending" && (
            <p className="text-sm text-muted-foreground mb-3">Waiting for mentor to accept...</p>
          )}

          {/* Cancelled */}
          {b.status === "cancelled" && (
            <p className="text-sm text-destructive mb-3">Booking declined. Coins refunded.</p>
          )}

          {/* Completed */}
          {b.status === "completed" && (
            <p className="text-sm text-primary mb-3">✅ Session completed. Coins transferred to mentor.</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {b.meeting_link && (
              <a href={b.meeting_link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant={b.status === "confirmed" ? "default" : "outline"} className="gap-1">
                  <Video className="w-3 h-3" /> {b.status === "confirmed" ? "Join Meeting" : "Meeting"}
                </Button>
              </a>
            )}
            {b.status !== "cancelled" && (
              <Button size="sm" variant="outline" onClick={() => openChat(b)} className="gap-1">
                <MessageSquare className="w-3 h-3" /> Chat
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => viewProfile(otherUserId)} className="gap-1">
              <User className="w-3 h-3" /> Profile
            </Button>
            {canReview && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-primary text-primary"
                onClick={() => { setReviewBookingId(b.id); setReviewMentorId(b.mentor_id); }}
              >
                <Star className="w-3 h-3" /> Complete & Review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // If view prop is provided, render only that section without tabs
  if (view === "bookings") {
    return (
      <>
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
            {bookingsAsMentor.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" /> Incoming Requests (as Mentor)
                </h3>
                <div className="space-y-3">
                  {bookingsAsMentor.map(b => renderBookingCard(b, "mentor"))}
                </div>
              </div>
            )}
            {bookingsAsLearner.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> My Booked Sessions
                </h3>
                <div className="space-y-3">
                  {bookingsAsLearner.map(b => renderBookingCard(b, "learner"))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Profile Viewer */}
        <ProfileViewer 
          open={profileOpen} 
          onOpenChange={setProfileOpen} 
          userId={profileUserId}
        />
        {/* Chat Dialog */}
        {chatBooking && (
          <BookingChat 
            open={chatOpen} 
            onOpenChange={setChatOpen} 
            booking={chatBooking}
            currentUserId={currentUserId}
          />
        )}
      </>
    );
  }

  if (view === "requests") {
    return (
      <>
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
        {/* Profile Viewer */}
        <ProfileViewer 
          open={profileOpen} 
          onOpenChange={setProfileOpen} 
          userId={profileUserId}
        />
      </>
    );
  }

  if (view === "responses") {
    return (
      <>
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
            {myResponses.map((resp) => (
              <Card key={resp.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Offer sent</CardTitle>
                    <Badge variant={resp.status === "pending" ? "secondary" : resp.status === "accepted" ? "default" : "outline"} className="gap-1">
                      {resp.status === "pending" ? <Clock className="w-3 h-3" /> : resp.status === "accepted" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {resp.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {formatDistanceToNow(new Date(resp.created_at), { addSuffix: true })}
                    {resp.proposed_rate != null && ` • ${resp.proposed_rate} coins/hr`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">{resp.message}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resp.responder_skills?.map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Profile Viewer */}
        <ProfileViewer 
          open={profileOpen} 
          onOpenChange={setProfileOpen} 
          userId={profileUserId}
        />
      </>
    );
  }

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
              {bookingsAsMentor.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" /> Incoming Requests (as Mentor)
                  </h3>
                  <div className="space-y-3">
                    {bookingsAsMentor.map(b => renderBookingCard(b, "mentor"))}
                  </div>
                </div>
              )}
              {bookingsAsLearner.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" /> My Booked Sessions
                  </h3>
                  <div className="space-y-3">
                    {bookingsAsLearner.map(b => renderBookingCard(b, "learner"))}
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

      {/* Review Dialog */}
      <Dialog open={!!reviewBookingId} onOpenChange={(open) => { if (!open) setReviewBookingId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Session & Review</DialogTitle>
            <DialogDescription>
              Confirm the session is complete. Coins will be transferred to the mentor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setReviewRating(s)} className="p-1">
                    <Star className={`w-6 h-6 transition-colors ${s <= reviewRating ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Review (optional)</label>
              <Textarea
                placeholder="How was your session?"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
              />
            </div>
            <Button onClick={handleSubmitReview} disabled={reviewSubmitting} className="w-full gap-2">
              <ThumbsUp className="w-4 h-4" />
              {reviewSubmitting ? "Submitting..." : "Confirm Completion & Transfer Coins"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
