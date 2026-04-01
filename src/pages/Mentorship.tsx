import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LearningRequestForm } from "@/components/mentorship/LearningRequestForm";
import { LearningRequestsList } from "@/components/mentorship/LearningRequestsList";
import { MyBookings } from "@/components/mentorship/MyBookings";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Lock, 
  Brain, 
  TrendingUp, 
  Code, 
  Zap, 
  Terminal,
  CheckCircle2,
  Star,
  Clock,
  Video,
  Calendar,
  Award,
  Users,
  ArrowRight,
  Linkedin,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Coins,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useSpendCoins } from "@/hooks/useSpendCoins";
import { useToast } from "@/hooks/use-toast";

interface MentorshipTopic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
}

interface Mentor {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatar_url: string | null;
  expertise: string[];
  experience_years: number;
  hourly_rate: number;
  is_verified: boolean;
  linkedin_url: string | null;
  calendly_url: string | null;
}

interface MyRequest {
  id: string;
  title: string;
  status: string;
  created_at: string;
  skills: string[];
}

interface MyResponse {
  id: string;
  message: string;
  status: string;
  created_at: string;
  request_id: string;
}

const iconMap: Record<string, React.ElementType> = {
  Shield, Lock, Brain, TrendingUp, Code, Zap, Terminal
};

export default function Mentorship() {
  const [topics, setTopics] = useState<MentorshipTopic[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [myResponses, setMyResponses] = useState<MyResponse[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bookingMentorId, setBookingMentorId] = useState<string | null>(null);
  const { spendCoins, balance } = useSpendCoins();
  const { toast } = useToast();

  const handleBookWithCoins = async (mentor: Mentor) => {
    setBookingMentorId(mentor.id);
    const success = await spendCoins(mentor.hourly_rate, `Mentorship session with ${mentor.name}`);
    if (success) {
      // Create a booking record
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("mentorship_bookings").insert({
          user_id: user.id,
          mentor_id: mentor.id,
          topic_id: topics[0]?.id || mentor.id, // fallback
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_price: mentor.hourly_rate,
          status: "pending",
          notes: `Booked via coin payment (${mentor.hourly_rate} coins)`,
        });

        if (error) {
          toast({ title: "Booking Error", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Booking Request Sent!", description: `Your request has been sent to ${mentor.name}. Check 'My Bookings' tab for updates.` });
        }
      }
    }
    setBookingMentorId(null);
  };

  const [communityMentors, setCommunityMentors] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);

    const [topicsRes, mentorsRes, communityRes] = await Promise.all([
      supabase.from("mentorship_topics").select("*"),
      supabase.from("mentors").select("*"),
      supabase.from("profiles").select("*").eq("is_available_as_mentor", true)
    ]);

    if (topicsRes.data) setTopics(topicsRes.data);
    if (mentorsRes.data) setMentors(mentorsRes.data);
    if (communityRes.data) setCommunityMentors(communityRes.data);

    if (user) {
      const [requestsRes, responsesRes] = await Promise.all([
        supabase
          .from("learning_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("learning_request_responses")
          .select("*")
          .eq("responder_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (requestsRes.data) setMyRequests(requestsRes.data);
      if (responsesRes.data) setMyResponses(responsesRes.data);
    }

    setLoading(false);
  };

  const handleCloseRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("learning_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (!error) {
      toast({ title: "Request closed", description: "Your learning request has been closed." });
      setRefreshKey((k) => k + 1);
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Combine official mentors + community mentors (avoid duplicates by name)
  const officialMentorNames = new Set(mentors.map(m => m.name.toLowerCase()));
  const allMentors = [
    ...mentors,
    ...communityMentors
      .filter(p => !officialMentorNames.has(p.full_name?.toLowerCase()))
      .map(p => ({
        id: p.id,
        name: p.full_name,
        title: p.bio?.substring(0, 80) || 'Community Mentor',
        bio: p.bio || 'Available for mentorship sessions',
        avatar_url: null,
        expertise: p.skills || [],
        experience_years: p.experience_years || 0,
        hourly_rate: p.hourly_rate || 0,
        is_verified: false,
        linkedin_url: p.linkedin_url,
        calendly_url: null,
        _isCommunity: true,
      }))
  ];

  const filteredMentors = selectedTopic
    ? allMentors.filter(m => m.expertise.some((e: string) => 
        e.toLowerCase().includes(selectedTopic.toLowerCase())
      ))
    : allMentors;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="section-container">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 text-xs font-medium uppercase tracking-wider">
            Learn & Mentorship
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Learn Real Skills from <span className="text-gradient">Real People</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Book 1-on-1 sessions with verified professionals or post what you want to learn 
            and get matched with skilled mentors and students in our community.
          </p>
          
          {/* Value Props */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Video, label: "Live 1-on-1 Sessions" },
              { icon: Award, label: "Verified Professionals" },
              { icon: HelpCircle, label: "Post Learning Requests" },
              { icon: Users, label: "Community Mentors" }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                <item.icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LearningRequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            <Button variant="outline" size="lg" onClick={() => {
              document.getElementById('mentors-section')?.scrollIntoView({ behavior: 'smooth' });
            }} className="gap-2">
              <Users className="w-5 h-5" />
              Browse Professional Mentors
            </Button>
          </div>
        </div>
      </section>

      {/* Main Tabs Section */}
      <section className="section-container bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="mentors" className="w-full">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
              <TabsTrigger value="mentors" className="gap-1">
                <Users className="w-4 h-4 hidden sm:block" />
                Mentors
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-1">
                <BookOpen className="w-4 h-4 hidden sm:block" />
                Requests
              </TabsTrigger>
              <TabsTrigger value="my-requests" className="gap-1">
                <HelpCircle className="w-4 h-4 hidden sm:block" />
                My Requests
              </TabsTrigger>
              <TabsTrigger value="my-responses" className="gap-1">
                <MessageSquare className="w-4 h-4 hidden sm:block" />
                My Offers
              </TabsTrigger>
            </TabsList>

            {/* Mentors Tab */}
            <TabsContent value="mentors" id="mentors-section">
              {/* Topics Filter */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-center">Filter by Learning Path</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {topics.map((topic) => {
                    const IconComponent = iconMap[topic.icon] || Code;
                    const isSelected = selectedTopic === topic.slug;
                    
                    return (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(isSelected ? null : topic.slug)}
                        className={cn(
                          "p-4 rounded-xl text-left transition-all duration-300 border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                            : "bg-card hover:bg-secondary border-border hover:border-primary/50"
                        )}
                      >
                        <IconComponent className={cn(
                          "w-6 h-6 mb-2",
                          isSelected ? "text-primary-foreground" : "text-primary"
                        )} />
                        <h4 className="font-medium text-sm">{topic.name}</h4>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mentors Grid */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">
                  {selectedTopic ? `${topics.find(t => t.slug === selectedTopic)?.name} Mentors` : "All Mentors"}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Verified professionals with real-world industry experience
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredMentors.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Mentors Available Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      We're onboarding verified professionals. Check back soon or post a learning request!
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button variant="outline" onClick={() => setSelectedTopic(null)}>
                        View All Topics
                      </Button>
                      <LearningRequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMentors.map((mentor) => (
                    <Card key={mentor.id} className="overflow-hidden group hover:shadow-xl transition-shadow">
                      <CardHeader className="pb-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
                            {mentor.avatar_url ? (
                              <img src={mentor.avatar_url} alt={mentor.name} className="w-full h-full object-cover" />
                            ) : (
                              mentor.name.charAt(0)
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{mentor.name}</CardTitle>
                              {mentor.is_verified && (
                                <CheckCircle2 className="w-5 h-5 text-primary fill-primary/20" />
                              )}
                            </div>
                            <CardDescription>{mentor.title}</CardDescription>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {mentor.experience_years}+ years
                              </Badge>
                              {mentor.linkedin_url && (
                                <a 
                                  href={mentor.linkedin_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <Linkedin className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                          {mentor.bio}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {mentor.expertise.slice(0, 4).map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <div>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-primary" />
                              <span className="text-2xl font-bold text-primary">{mentor.hourly_rate}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">coins/hour</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="gap-1"
                              onClick={() => handleBookWithCoins(mentor)}
                              disabled={bookingMentorId === mentor.id || (balance ? balance.balance < mentor.hourly_rate : true)}
                            >
                              <Coins className="w-3 h-3" />
                              {bookingMentorId === mentor.id ? "Booking..." : "Book"}
                            </Button>
                            {mentor.calendly_url && (
                              <a href={mentor.calendly_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Calendly
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                        {balance && balance.balance < mentor.hourly_rate && (
                          <p className="text-xs text-destructive mt-2">
                            Insufficient balance — <Link to="/wallet" className="underline">Buy Coins</Link>
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Browse Requests Tab */}
            <TabsContent value="requests">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Learning Requests</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Help others learn by offering your expertise
                </p>
              </div>
              <LearningRequestsList key={refreshKey} />
            </TabsContent>

            {/* My Requests Tab */}
            <TabsContent value="my-requests">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">My Learning Requests</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Track your posted requests and responses
                </p>
              </div>

              {!isLoggedIn ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
                    <p className="text-muted-foreground mb-4">
                      Please sign in to view your learning requests
                    </p>
                    <Button asChild>
                      <Link to="/auth">Sign In</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : myRequests.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Requests Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Post your first learning request to get started!
                    </p>
                    <LearningRequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {myRequests.map((req) => (
                    <Card key={req.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{req.title}</CardTitle>
                          <Badge
                            variant={req.status === "open" ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {req.status === "open" ? (
                              <Clock className="w-3 h-3" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {req.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          Posted {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1.5">
                            {req.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                          {req.status === "open" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCloseRequest(req.id)}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* My Responses Tab */}
            <TabsContent value="my-responses">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">My Help Offers</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Track your offers to help other learners
                </p>
              </div>

              {!isLoggedIn ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
                    <p className="text-muted-foreground mb-4">
                      Please sign in to view your responses
                    </p>
                    <Button asChild>
                      <Link to="/auth">Sign In</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : myResponses.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Responses Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Browse learning requests and offer to help others!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {myResponses.map((res) => (
                    <Card key={res.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg line-clamp-1">
                            {res.message.substring(0, 50)}...
                          </CardTitle>
                          <Badge variant="secondary">{res.status}</Badge>
                        </div>
                        <CardDescription>
                          Sent {formatDistanceToNow(new Date(res.created_at), { addSuffix: true })}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Two ways to learn - choose what suits you best</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Option 1: Book a Mentor */}
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                Book a Professional Mentor
              </h3>
              <div className="space-y-4">
                {[
                  { step: 1, title: "Choose Topic", desc: "Select the skill you want to learn" },
                  { step: 2, title: "Pick a Mentor", desc: "Browse verified professionals" },
                  { step: 3, title: "Book & Pay", desc: "Select time slot and complete payment" },
                  { step: 4, title: "Learn Live", desc: "Join via Google Meet or Zoom" }
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Option 2: Post a Request */}
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Post a Learning Request
              </h3>
              <div className="space-y-4">
                {[
                  { step: 1, title: "Describe Your Need", desc: "What do you want to learn or get help with?" },
                  { step: 2, title: "Add Skills & Budget", desc: "Specify technologies and your budget range" },
                  { step: 3, title: "Get Responses", desc: "Community mentors will offer to help" },
                  { step: 4, title: "Choose & Connect", desc: "Pick the best match and start learning" }
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-semibold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="section-container bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-background border-dashed">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Important Disclaimer
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our mentorship program provides skill-based learning through 1-on-1 sessions with verified professionals 
                and community members. Learning outcomes depend on individual effort, dedication, and practice. This is 
                not a job guarantee or certification program. Mentors share practical knowledge from their real-world 
                experience to help you build skills and confidence in your chosen field.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-muted-foreground mb-8">
            Join hundreds of learners who are building real skills with expert mentors
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LearningRequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact" className="gap-2">
                Become a Mentor <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
