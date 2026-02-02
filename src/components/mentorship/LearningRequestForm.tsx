import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, X, Send, BookOpen } from "lucide-react";

const requestSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(100),
  description: z.string().min(30, "Description must be at least 30 characters").max(1000),
  request_type: z.enum(["learn", "consulting", "project_help"]),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  preferred_duration: z.string().optional(),
  urgency: z.enum(["low", "normal", "high"]),
});

type RequestFormData = z.infer<typeof requestSchema>;

const skillSuggestions = [
  "Python", "JavaScript", "React", "Node.js", "AWS", "Cybersecurity",
  "SEO", "AI/ML", "Docker", "Kubernetes", "SQL", "MongoDB",
  "Blockchain", "Web Development", "Mobile Development", "DevOps",
  "Penetration Testing", "Network Security", "Cloud Computing", "Data Science"
];

interface LearningRequestFormProps {
  onSuccess?: () => void;
}

export function LearningRequestForm({ onSuccess }: LearningRequestFormProps) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      request_type: "learn",
      urgency: "normal",
    },
  });

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed) && skills.length < 5) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const onSubmit = async (data: RequestFormData) => {
    if (skills.length === 0) {
      toast({
        title: "Skills Required",
        description: "Please add at least one skill you want to learn.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit a learning request.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("learning_requests").insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      request_type: data.request_type,
      skills: skills,
      budget_min: data.budget_min ? parseFloat(data.budget_min) : null,
      budget_max: data.budget_max ? parseFloat(data.budget_max) : null,
      preferred_duration: data.preferred_duration || null,
      urgency: data.urgency,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Request Submitted!",
      description: "Your learning request is now visible to mentors with matching skills.",
    });

    reset();
    setSkills([]);
    setOpen(false);
    onSuccess?.();
  };

  const filteredSuggestions = skillSuggestions.filter(
    (s) => 
      s.toLowerCase().includes(skillInput.toLowerCase()) && 
      !skills.includes(s)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <BookOpen className="w-5 h-5" />
          Post a Learning Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">What do you want to learn?</DialogTitle>
          <DialogDescription>
            Describe what you want to learn or get help with. Mentors with matching skills will see your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          {/* Request Type */}
          <div className="space-y-2">
            <Label>Request Type</Label>
            <Select
              value={watch("request_type")}
              onValueChange={(value: "learn" | "consulting" | "project_help") => 
                setValue("request_type", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learn">🎓 Learn a Skill/Technology</SelectItem>
                <SelectItem value="consulting">💡 Consulting/Advice</SelectItem>
                <SelectItem value="project_help">🔧 Project Help</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Learn Python for Cybersecurity Scripting"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Describe what you want to learn</Label>
            <Textarea
              id="description"
              placeholder="What are your goals? What's your current skill level? What specific topics do you want to cover?"
              rows={4}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills/Technologies (max 5)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1 py-1 px-3">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
              />
              {skillInput && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                  {filteredSuggestions.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-sm"
                      onClick={() => addSkill(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Budget Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_min">Budget Min (₹/hour) - Optional</Label>
              <Input
                id="budget_min"
                type="number"
                placeholder="e.g., 500"
                {...register("budget_min")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_max">Budget Max (₹/hour) - Optional</Label>
              <Input
                id="budget_max"
                type="number"
                placeholder="e.g., 1500"
                {...register("budget_max")}
              />
            </div>
          </div>

          {/* Duration & Urgency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_duration">Preferred Duration - Optional</Label>
              <Input
                id="preferred_duration"
                placeholder="e.g., 2 weeks, 1 month"
                {...register("preferred_duration")}
              />
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select
                value={watch("urgency")}
                onValueChange={(value: "low" | "normal" | "high") => 
                  setValue("urgency", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Flexible timeline</SelectItem>
                  <SelectItem value="normal">Normal - Within a week</SelectItem>
                  <SelectItem value="high">High - ASAP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Request
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
