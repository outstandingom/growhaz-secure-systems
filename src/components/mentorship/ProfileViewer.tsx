import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Github, ExternalLink, Award, Clock, Code, Star, BookOpen, Coins } from "lucide-react";

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
  certificates: any[] | null;
}

interface ReviewData {
  rating: number;
  review_text: string | null;
  created_at: string;
}

export function ProfileViewer({ open, onOpenChange, userId }: ProfileViewerProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);

    const fetchAll = async () => {
      const [profileRes, reviewsRes, sessionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, bio, skills, experience_years, hourly_rate, linkedin_url, github_url, leetcode_url, is_available_as_mentor, certificates")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("session_reviews")
          .select("rating, review_text, created_at")
          .eq("mentor_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("mentorship_bookings")
          .select("id")
          .or(`user_id.eq.${userId},mentor_id.eq.${userId}`)
          .eq("status", "completed"),
      ]);

      if (profileRes.data) {
        setProfile({
          ...profileRes.data,
          skills: profileRes.data.skills || [],
          certificates: Array.isArray(profileRes.data.certificates) ? profileRes.data.certificates : [],
        });
      } else {
        setProfile(null);
      }

      setReviews((reviewsRes.data as ReviewData[]) || []);
      setSessionCount(sessionsRes.data?.length || 0);
      setLoading(false);
    };

    fetchAll();
  }, [userId, open]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{profile?.full_name || "Profile"}</SheetTitle>
          <SheetDescription>Profile & achievements</SheetDescription>
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
                  <Coins className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{profile.hourly_rate} coins/hr</span>
                </div>
              )}
              {sessionCount > 0 && (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-card/50 border border-border">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{sessionCount} sessions</span>
                </div>
              )}
              {avgRating && (
                <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-card/50 border border-border">
                  <Star className="w-5 h-5 text-primary fill-primary/20" />
                  <span className="text-sm font-medium">{avgRating} ★ ({reviews.length})</span>
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

            {/* Certificates */}
            {profile.certificates && profile.certificates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Certificates</h4>
                <div className="space-y-2">
                  {profile.certificates.map((cert: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border">
                      <Award className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cert.name}</p>
                        {cert.issuer && <p className="text-xs text-muted-foreground">{cert.issuer}</p>}
                      </div>
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Reviews</h4>
                <div className="space-y-2">
                  {reviews.slice(0, 5).map((r, i) => (
                    <div key={i} className="p-3 rounded-xl bg-card/50 border border-border">
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                      {r.review_text && <p className="text-xs text-muted-foreground">{r.review_text}</p>}
                    </div>
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
