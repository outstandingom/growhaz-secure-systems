import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Edit3, 
  Save, 
  X, 
  Linkedin, 
  Github, 
  Code2,
  Award,
  Plus,
  Trash2,
  ExternalLink,
  GraduationCap,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Certificate {
  name: string;
  issuer: string;
  url?: string;
  date?: string;
}

interface MentorProfile {
  github_url: string | null;
  linkedin_url: string | null;
  leetcode_url: string | null;
  certificates: Certificate[];
  skills: string[];
  hourly_rate: number | null;
  bio: string | null;
  is_available_as_mentor: boolean;
  experience_years: number;
}

interface MentorProfileSectionProps {
  profileId: string;
  mentorData: MentorProfile;
  onUpdate: (data: MentorProfile) => void;
}

export function MentorProfileSection({ profileId, mentorData, onUpdate }: MentorProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<MentorProfile>(mentorData);
  const [skillInput, setSkillInput] = useState("");
  const [newCertificate, setNewCertificate] = useState<Certificate>({ name: "", issuer: "", url: "", date: "" });
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    
    // Convert certificates to plain objects for JSON storage
    const certificatesJson = editData.certificates.map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      url: cert.url || null,
      date: cert.date || null,
    }));
    
    const { error } = await supabase
      .from("profiles")
      .update({
        github_url: editData.github_url || null,
        linkedin_url: editData.linkedin_url || null,
        leetcode_url: editData.leetcode_url || null,
        certificates: JSON.parse(JSON.stringify(certificatesJson)),
        skills: editData.skills,
        hourly_rate: editData.hourly_rate,
        bio: editData.bio || null,
        is_available_as_mentor: editData.is_available_as_mentor,
        experience_years: editData.experience_years,
      })
      .eq("id", profileId);

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update mentor profile.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Mentor profile updated successfully.",
    });
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(mentorData);
    setIsEditing(false);
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !editData.skills.includes(trimmed) && editData.skills.length < 10) {
      setEditData({ ...editData, skills: [...editData.skills, trimmed] });
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setEditData({ ...editData, skills: editData.skills.filter(s => s !== skill) });
  };

  const addCertificate = () => {
    if (newCertificate.name && newCertificate.issuer) {
      setEditData({ 
        ...editData, 
        certificates: [...editData.certificates, newCertificate] 
      });
      setNewCertificate({ name: "", issuer: "", url: "", date: "" });
    }
  };

  const removeCertificate = (index: number) => {
    setEditData({ 
      ...editData, 
      certificates: editData.certificates.filter((_, i) => i !== index) 
    });
  };

  const toggleMentorAvailability = async (checked: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_available_as_mentor: checked })
      .eq("id", profileId);

    if (!error) {
      setEditData({ ...editData, is_available_as_mentor: checked });
      onUpdate({ ...editData, is_available_as_mentor: checked });
      toast({
        title: checked ? "You're now a mentor!" : "Mentor status disabled",
        description: checked 
          ? "Others can now see your profile and request mentorship." 
          : "You won't receive new mentorship requests.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Mentor/Learner Toggle */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/20">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Available as Mentor</h3>
              <p className="text-sm text-muted-foreground">
                {editData.is_available_as_mentor 
                  ? "Your profile is visible to learners looking for mentors" 
                  : "Enable to let others find and learn from you"}
              </p>
            </div>
          </div>
          <Switch
            checked={editData.is_available_as_mentor}
            onCheckedChange={toggleMentorAvailability}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Mentor & Learner Profile</h2>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button variant="hero" size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Bio */}
          <div className="space-y-2">
            <Label>Bio / About You</Label>
            {isEditing ? (
              <Textarea
                placeholder="Tell others about yourself, your experience, and what you can teach..."
                value={editData.bio || ""}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                rows={3}
              />
            ) : (
              <p className="text-muted-foreground">
                {editData.bio || "No bio added yet"}
              </p>
            )}
          </div>

          {/* Experience & Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Years of Experience</Label>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  value={editData.experience_years}
                  onChange={(e) => setEditData({ ...editData, experience_years: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <p className="text-lg font-medium">{editData.experience_years} years</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate (₹)</Label>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g., 500"
                  value={editData.hourly_rate || ""}
                  onChange={(e) => setEditData({ ...editData, hourly_rate: parseFloat(e.target.value) || null })}
                />
              ) : (
                <p className="text-lg font-medium">
                  {editData.hourly_rate ? `₹${editData.hourly_rate}/hour` : "Not set"}
                </p>
              )}
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills & Expertise (max 10)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {editData.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1 py-1 px-3">
                  {skill}
                  {isEditing && (
                    <button onClick={() => removeSkill(skill)} className="ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {editData.skills.length === 0 && !isEditing && (
                <span className="text-muted-foreground text-sm">No skills added</span>
              )}
            </div>
            {isEditing && (
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
            )}
          </div>

          {/* Verification Links */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Verification Links
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* LinkedIn */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-[#0077B5]" />
                  LinkedIn
                </Label>
                {isEditing ? (
                  <Input
                    placeholder="https://linkedin.com/in/yourprofile"
                    value={editData.linkedin_url || ""}
                    onChange={(e) => setEditData({ ...editData, linkedin_url: e.target.value })}
                  />
                ) : editData.linkedin_url ? (
                  <a 
                    href={editData.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">Not linked</span>
                )}
              </div>

              {/* GitHub */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Github className="w-4 h-4" />
                  GitHub
                </Label>
                {isEditing ? (
                  <Input
                    placeholder="https://github.com/yourusername"
                    value={editData.github_url || ""}
                    onChange={(e) => setEditData({ ...editData, github_url: e.target.value })}
                  />
                ) : editData.github_url ? (
                  <a 
                    href={editData.github_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">Not linked</span>
                )}
              </div>

              {/* LeetCode */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-500" />
                  LeetCode
                </Label>
                {isEditing ? (
                  <Input
                    placeholder="https://leetcode.com/yourusername"
                    value={editData.leetcode_url || ""}
                    onChange={(e) => setEditData({ ...editData, leetcode_url: e.target.value })}
                  />
                ) : editData.leetcode_url ? (
                  <a 
                    href={editData.leetcode_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    View Profile <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">Not linked</span>
                )}
              </div>
            </div>
          </div>

          {/* Certificates */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Certificates & Achievements
            </h3>

            {editData.certificates.length > 0 ? (
              <div className="space-y-3">
                {editData.certificates.map((cert, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                  >
                    <div>
                      <p className="font-medium">{cert.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {cert.issuer} {cert.date && `• ${cert.date}`}
                      </p>
                      {cert.url && (
                        <a 
                          href={cert.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                        >
                          View Certificate <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    {isEditing && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeCertificate(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No certificates added</p>
            )}

            {isEditing && (
              <div className="p-4 rounded-lg border border-dashed border-border space-y-3">
                <p className="text-sm font-medium">Add New Certificate</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Certificate Name"
                    value={newCertificate.name}
                    onChange={(e) => setNewCertificate({ ...newCertificate, name: e.target.value })}
                  />
                  <Input
                    placeholder="Issuing Organization"
                    value={newCertificate.issuer}
                    onChange={(e) => setNewCertificate({ ...newCertificate, issuer: e.target.value })}
                  />
                  <Input
                    placeholder="Certificate URL (optional)"
                    value={newCertificate.url || ""}
                    onChange={(e) => setNewCertificate({ ...newCertificate, url: e.target.value })}
                  />
                  <Input
                    placeholder="Date (e.g., Jan 2024)"
                    value={newCertificate.date || ""}
                    onChange={(e) => setNewCertificate({ ...newCertificate, date: e.target.value })}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addCertificate}
                  disabled={!newCertificate.name || !newCertificate.issuer}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Certificate
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
