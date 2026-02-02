import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LearningRequestForm } from "@/components/mentorship/LearningRequestForm";
import { LearningRequestsList } from "@/components/mentorship/LearningRequestsList";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  ArrowRight,
  CheckCircle2,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

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

export default function LearningRequests() {
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [myResponses, setMyResponses] = useState<MyResponse[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkAuthAndFetch();
  }, [refreshKey]);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);

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

  return (
    <Layout>
      {/* Hero Section */}
      <section className="section-container">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 text-xs font-medium uppercase tracking-wider">
            Community Learning
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Learn Anything from <span className="text-gradient">Real People</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Post what you want to learn and get matched with skilled mentors and students. 
            Share your knowledge by helping others learn.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <LearningRequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
            <Button variant="outline" size="lg" asChild>
              <Link to="/mentorship" className="gap-2">
                <Users className="w-5 h-5" />
                Browse Professional Mentors
              </Link>
            </Button>
          </div>

          {/* Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: BookOpen,
                title: "Post Your Request",
                desc: "Describe what you want to learn or need help with",
              },
              {
                icon: Users,
                title: "Get Matched",
                desc: "Skilled mentors see requests matching their expertise",
              },
              {
                icon: MessageSquare,
                title: "Connect & Learn",
                desc: "Choose the best mentor and start learning",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/50 border border-border"
              >
                <div className="p-3 rounded-xl bg-primary/10">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground text-center">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section-container bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="browse" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="browse">Browse Requests</TabsTrigger>
              <TabsTrigger value="my-requests">My Requests</TabsTrigger>
              <TabsTrigger value="my-responses">My Responses</TabsTrigger>
            </TabsList>

            <TabsContent value="browse">
              <LearningRequestsList key={refreshKey} />
            </TabsContent>

            <TabsContent value="my-requests">
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
                        <div className="flex flex-wrap gap-1.5">
                          {req.skills.map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-responses">
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

      {/* CTA */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Have Deep Expertise?</h2>
          <p className="text-muted-foreground mb-8">
            Apply to become a verified mentor and help learners while earning
          </p>
          <Button size="lg" variant="outline" asChild>
            <Link to="/contact" className="gap-2">
              Apply as Mentor <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
