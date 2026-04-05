import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Github, ExternalLink, Award, Clock, Code } from "lucide-react";

interface ProfileViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

interface ProfileData {
  full_name: string;
  bio: string | null;
  skills: string[];
  experience_years: number | null;
  hourly_rate: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  leetcode_url: string | null;
  is_available_as_mentor: boolean | null;
}

export function ProfileViewer({ open, onOpenChange, userId }: ProfileViewerProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("full_name, bio, skills, experience_years, hourly_rate, linkedin_url, github_url, leetcode_url, is_available_as_mentor")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ? { ...data, skills: data.skills || [] } : null);
        setLoading(false);
      });
  }, [userId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{profile?.full_name || "Profile"}</SheetTitle>
          <SheetDescription>User profile details</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground text-center py-12">Profile not found</p>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Avatar + Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl font-bold text-primary">
                {profile.full_name?.charAt(0) || "?"}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{profile.full_name}</h3>
                {profile.is_available_as_mentor && (
                  <Badge variant="default" className="text-xs gap-1">
                    <Award className="w-3 h-3" /> Mentor
                  </Badge>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">About</h4>
                <p className="text-sm">{profile.bio}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {profile.experience_years != null && (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-card/50 border border-border">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{profile.experience_years}+ years</span>
                </div>
              )}
              {profile.hourly_rate != null && (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-card/50 border border-border">
                  <Code className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{profile.hourly_rate} coins/hr</span>
                </div>
              )}
            </div>

            {/* Skills */}
            {profile.skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="space-y-2">
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Linkedin className="w-4 h-4" /> LinkedIn <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {profile.github_url && (
                <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Github className="w-4 h-4" /> GitHub <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
