import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Lightbulb, 
  Wrench, 
  Clock, 
  DollarSign,
  Send,
  Search,
  Filter,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface LearningRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  request_type: string;
  skills: string[];
  budget_min: number | null;
  budget_max: number | null;
  preferred_duration: string | null;
  urgency: string;
  status: string;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  learn: BookOpen,
  consulting: Lightbulb,
  project_help: Wrench,
};

const typeLabels: Record<string, string> = {
  learn: "Learning",
  consulting: "Consulting",
  project_help: "Project Help",
};

const urgencyColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/10 text-primary",
  high: "bg-destructive/10 text-destructive",
};

export function LearningRequestsList() {
  const [requests, setRequests] = useState<LearningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterSkill, setFilterSkill] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LearningRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [mySkills, setMySkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("learning_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const allSkills = [...new Set(requests.flatMap((r) => r.skills))];

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = !filterType || r.request_type === filterType;
    const matchesSkill = !filterSkill || r.skills.includes(filterSkill);
    
    return matchesSearch && matchesType && matchesSkill;
  });

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !mySkills.includes(trimmed) && mySkills.length < 5) {
      setMySkills([...mySkills, trimmed]);
      setSkillInput("");
    }
  };

  const handleRespond = async () => {
    if (!selectedRequest || !currentUserId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to respond to requests.",
        variant: "destructive",
      });
      return;
    }

    if (!responseMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please write a message to the learner.",
        variant: "destructive",
      });
      return;
    }

    if (mySkills.length === 0) {
      toast({
        title: "Skills Required",
        description: "Please add at least one skill you can help with.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", currentUserId)
      .single();

    const { error } = await supabase.from("learning_request_responses").insert({
      request_id: selectedRequest.id,
      responder_id: currentUserId,
      responder_name: profile?.full_name || "Anonymous",
      responder_skills: mySkills,
      message: responseMessage,
      proposed_rate: proposedRate ? parseFloat(proposedRate) : null,
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit response. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Response Sent!",
      description: "The learner will be notified of your interest.",
    });

    setSelectedRequest(null);
    setResponseMessage("");
    setProposedRate("");
    setMySkills([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requests by title, description, or skill..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterType === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(null)}
          >
            All
          </Button>
          {Object.entries(typeLabels).map(([key, label]) => (
            <Button
              key={key}
              variant={filterType === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(filterType === key ? null : key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Skill Filter */}
      {allSkills.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filter by skill:</span>
          {allSkills.slice(0, 10).map((skill) => (
            <Badge
              key={skill}
              variant={filterSkill === skill ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterSkill(filterSkill === skill ? null : skill)}
            >
              {skill}
            </Badge>
          ))}
        </div>
      )}

      {/* Requests Grid */}
      {filteredRequests.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Requests Found</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterType || filterSkill
                ? "Try adjusting your filters"
                : "Be the first to post a learning request!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredRequests.map((request) => {
            const TypeIcon = typeIcons[request.request_type] || BookOpen;
            const isOwn = request.user_id === currentUserId;

            return (
              <Card 
                key={request.id} 
                className={cn(
                  "hover:shadow-lg transition-shadow",
                  isOwn && "border-primary/50 bg-primary/5"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <TypeIcon className="w-4 h-4 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[request.request_type]}
                      </Badge>
                      <Badge className={cn("text-xs", urgencyColors[request.urgency])}>
                        {request.urgency === "high" ? "Urgent" : request.urgency}
                      </Badge>
                    </div>
                    {isOwn && (
                      <Badge variant="secondary" className="text-xs">
                        Your Request
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-2 line-clamp-2">
                    {request.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {request.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {request.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    {(request.budget_min || request.budget_max) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ₹{request.budget_min || 0} - ₹{request.budget_max || "∞"}/hr
                      </span>
                    )}
                    {request.preferred_duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {request.preferred_duration}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                    {!isOwn && (
                      <Button 
                        size="sm" 
                        className="gap-1"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <Send className="w-3 h-3" />
                        Offer to Help
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to Learning Request</DialogTitle>
            <DialogDescription>
              Introduce yourself and explain how you can help with "{selectedRequest?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Your Skills */}
            <div className="space-y-2">
              <Label>Your Relevant Skills</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {mySkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button onClick={() => setMySkills(mySkills.filter(s => s !== skill))}>
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add your skills (press Enter)"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="response-message">Your Message</Label>
              <Textarea
                id="response-message"
                placeholder="Introduce yourself, your experience, and how you can help..."
                rows={4}
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
            </div>

            {/* Proposed Rate */}
            <div className="space-y-2">
              <Label htmlFor="proposed-rate">Your Rate (₹/hour) - Optional</Label>
              <Input
                id="proposed-rate"
                type="number"
                placeholder="e.g., 800"
                value={proposedRate}
                onChange={(e) => setProposedRate(e.target.value)}
              />
            </div>

            <Button 
              className="w-full gap-2" 
              onClick={handleRespond}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Response
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
