import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
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
  Linkedin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const iconMap: Record<string, React.ElementType> = {
  Shield, Lock, Brain, TrendingUp, Code, Zap, Terminal
};

export default function Mentorship() {
  const [topics, setTopics] = useState<MentorshipTopic[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [topicsRes, mentorsRes] = await Promise.all([
      supabase.from("mentorship_topics").select("*"),
      supabase.from("mentors").select("*")
    ]);

    if (topicsRes.data) setTopics(topicsRes.data);
    if (mentorsRes.data) setMentors(mentorsRes.data);
    setLoading(false);
  };

  const filteredMentors = selectedTopic
    ? mentors.filter(m => m.expertise.some(e => 
        e.toLowerCase().includes(selectedTopic.toLowerCase())
      ))
    : mentors;

  return (
    <Layout>
      {/* Hero Section */}
      <section className="section-container">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 text-xs font-medium uppercase tracking-wider">
            Learn & Mentorship
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Learn Real Skills from <span className="text-gradient">Verified Experts</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Get personalized 1-on-1 mentoring sessions with industry professionals. 
            Learn Cybersecurity, AI, Web Development, SEO, and more through hands-on guidance.
          </p>
          
          {/* Value Props */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: Video, label: "Live 1-on-1 Sessions" },
              { icon: Award, label: "Verified Professionals" },
              { icon: Clock, label: "Flexible Scheduling" },
              { icon: Users, label: "Personalized Learning" }
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                <item.icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Topics Section */}
      <section className="section-container bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Choose Your Learning Path</h2>
            <p className="text-muted-foreground">Select a skill area to explore available mentors</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {topics.map((topic) => {
              const IconComponent = iconMap[topic.icon] || Code;
              const isSelected = selectedTopic === topic.slug;
              
              return (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(isSelected ? null : topic.slug)}
                  className={cn(
                    "p-6 rounded-2xl text-left transition-all duration-300 border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                      : "bg-card hover:bg-secondary border-border hover:border-primary/50"
                  )}
                >
                  <IconComponent className={cn(
                    "w-8 h-8 mb-3",
                    isSelected ? "text-primary-foreground" : "text-primary"
                  )} />
                  <h3 className="font-semibold mb-1">{topic.name}</h3>
                  <p className={cn(
                    "text-sm line-clamp-2",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {topic.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mentors Section */}
      <section className="section-container">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">
              {selectedTopic ? `${topics.find(t => t.slug === selectedTopic)?.name} Mentors` : "Meet Our Mentors"}
            </h2>
            <p className="text-muted-foreground">
              All mentors are verified professionals with real-world industry experience
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
                  We're onboarding verified professionals. Check back soon!
                </p>
                <Button variant="outline" onClick={() => setSelectedTopic(null)}>
                  View All Topics
                </Button>
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
                        <span className="text-2xl font-bold text-primary">₹{mentor.hourly_rate}</span>
                        <span className="text-sm text-muted-foreground">/hour</span>
                      </div>
                      {mentor.calendly_url ? (
                        <a href={mentor.calendly_url} target="_blank" rel="noopener noreferrer">
                          <Button className="gap-2">
                            <Calendar className="w-4 h-4" />
                            Book Session
                          </Button>
                        </a>
                      ) : (
                        <Button className="gap-2" disabled>
                          Coming Soon
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="section-container bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Book your personalized mentoring session in 4 simple steps</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: "Choose Topic", desc: "Select the skill you want to learn" },
              { step: 2, title: "Pick a Mentor", desc: "Browse verified professionals" },
              { step: 3, title: "Book & Pay", desc: "Select time slot and complete payment" },
              { step: 4, title: "Learn Live", desc: "Join via Google Meet or Zoom" }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                {idx < 3 && (
                  <ArrowRight className="hidden md:block absolute top-6 -right-3 w-6 h-6 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Important Disclaimer
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our mentorship program provides skill-based learning through 1-on-1 sessions with verified professionals. 
                Learning outcomes depend on individual effort, dedication, and practice. This is not a job guarantee or 
                certification program. Mentors share practical knowledge from their real-world experience to help you 
                build skills and confidence in your chosen field.
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
            <Button size="lg" className="gap-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Browse Mentors <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/contact">Become a Mentor</a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
