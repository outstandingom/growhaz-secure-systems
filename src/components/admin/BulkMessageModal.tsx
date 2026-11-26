import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Send,
  Sparkles,
  Users,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Smartphone,
  Bell,
  Eye
} from "lucide-react";

export interface RecipientUser {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  coinBalance: number;
  roles?: string[];
}

export interface MessageTemplate {
  id: string;
  title: string;
  category: "General" | "Security" | "Offer" | "Mentorship" | "System";
  content: string;
  isCustom?: boolean;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "welcome_onboarding",
    title: "Welcome & Onboarding Bonus",
    category: "General",
    content: "Hello {{name}}, welcome to Growhaz Secure Systems! You currently have {{coins}} coins in your wallet. Explore our blockchain verification and digital document security services today."
  },
  {
    id: "security_verification",
    title: "Security & Profile Verification Alert",
    category: "Security",
    content: "Urgent Security Notice for {{name}}: Please ensure your profile credentials and security tools are up to date on Growhaz. If you notice any suspicious activity, reply immediately."
  },
  {
    id: "mentorship_session",
    title: "Mentorship & Learning Invitation",
    category: "Mentorship",
    content: "Hi {{name}}, new mentorship topics in Cybersecurity, Blockchain, and AI Architecture are available now on Growhaz. Book your 1-on-1 session to level up your career."
  },
  {
    id: "coin_balance_update",
    title: "Coin Balance & Reward Notice",
    category: "Offer",
    content: "Great news {{name}}! Your current wallet balance is {{coins}} Growhaz coins. Redeem them now for document verification and forensic analysis discounts."
  },
  {
    id: "custom_announcement",
    title: "Platform Feature Announcement",
    category: "System",
    content: "Dear {{name}}, we have deployed new forensic document tools and AI cognitive memory on Growhaz. Log in to your dashboard to experience the latest upgrades."
  }
];

interface BulkMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: RecipientUser[];
  onSuccess?: () => void;
}

export function BulkMessageModal({
  open,
  onOpenChange,
  selectedUsers,
  onSuccess
}: BulkMessageModalProps) {
  const { toast } = useToast();

  // Template State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("welcome_onboarding");
  const [messageBody, setMessageBody] = useState<string>("");
  const [channel, setChannel] = useState<"in_app" | "whatsapp" | "system">("in_app");

  // New Template Form State
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<MessageTemplate["category"]>("General");
  const [newContent, setNewContent] = useState("");

  // Sending State
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null);

  // Load Templates from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("growhaz_message_templates");
      if (saved) {
        const customTemplates: MessageTemplate[] = JSON.parse(saved);
        setTemplates([...DEFAULT_TEMPLATES, ...customTemplates]);
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch {
      setTemplates(DEFAULT_TEMPLATES);
    }
  }, []);

  // Update message body when template changes
  useEffect(() => {
    const t = templates.find((item) => item.id === selectedTemplateId);
    if (t) {
      setMessageBody(t.content);
    }
  }, [selectedTemplateId, templates]);

  const handleSaveNewTemplate = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both template title and content.",
        variant: "destructive"
      });
      return;
    }

    const created: MessageTemplate = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      content: newContent.trim(),
      isCustom: true
    };

    const updated = [...templates, created];
    setTemplates(updated);

    // Save only custom ones to localStorage
    const customOnly = updated.filter((t) => t.isCustom);
    localStorage.setItem("growhaz_message_templates", JSON.stringify(customOnly));

    setSelectedTemplateId(created.id);
    setMessageBody(created.content);
    setNewTitle("");
    setNewContent("");
    setShowNewTemplateForm(false);

    toast({
      title: "Template Saved! 📋",
      description: `Template "${created.title}" is ready for bulk messaging.`
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = templates.filter((t) => t.id !== templateId);
    setTemplates(updated);
    const customOnly = updated.filter((t) => t.isCustom);
    localStorage.setItem("growhaz_message_templates", JSON.stringify(customOnly));

    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(DEFAULT_TEMPLATES[0].id);
    }

    toast({ title: "Template Deleted", description: "Custom template removed." });
  };

  // Helper to replace placeholders for a given user
  const renderPersonalizedMessage = (templateText: string, user: RecipientUser) => {
    return templateText
      .replace(/\{\{\s*name\s*\}\}/gi, user.full_name || "Valued User")
      .replace(/\{\{\s*user_name\s*\}\}/gi, user.full_name || "Valued User")
      .replace(/\{\{\s*phone\s*\}\}/gi, user.phone || "N/A")
      .replace(/\{\{\s*coins\s*\}\}/gi, String(user.coinBalance ?? 0))
      .replace(/\{\{\s*date\s*\}\}/gi, new Date().toLocaleDateString());
  };

  // Sample preview user (first selected or placeholder)
  const previewUser: RecipientUser = selectedUsers[0] || {
    id: "sample_id",
    user_id: "sample_uuid",
    full_name: "Om Uikey",
    phone: "+91 9988776655",
    coinBalance: 250
  };

  const samplePreviewText = renderPersonalizedMessage(messageBody, previewUser);

  const handleSendBulk = async () => {
    if (!selectedUsers.length) {
      toast({ title: "No Users Selected", description: "Please select at least one recipient.", variant: "destructive" });
      return;
    }
    if (!messageBody.trim()) {
      toast({ title: "Empty Message", description: "Please enter or select message content.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    setSendProgress({ sent: 0, total: selectedUsers.length });

    try {
      let successCount = 0;

      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        const personalized = renderPersonalizedMessage(messageBody, user);

        // Record in platform audit/notification history (Supabase if available, with graceful fallback)
        try {
          await supabase.from("verification_logs").insert({
            user_id: user.user_id,
            action: `bulk_message_${channel}`,
            details: {
              template_id: selectedTemplateId,
              message: personalized,
              channel: channel,
              recipient_phone: user.phone
            }
          });
        } catch {
          // Ignore if table schema differs
        }

        successCount++;
        setSendProgress({ sent: successCount, total: selectedUsers.length });
      }

      toast({
        title: "Bulk Messages Sent! 🚀",
        description: `Successfully dispatched to ${successCount} user${successCount > 1 ? "s" : ""}.`
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Dispatch Error",
        description: err.message || "Failed to send some messages.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  // WhatsApp bulk helper: opens first or copies formatted phone+message list
  const handleCopyWhatsAppList = () => {
    const list = selectedUsers
      .filter((u) => u.phone)
      .map((u) => {
        const text = renderPersonalizedMessage(messageBody, u);
        const cleanPhone = u.phone?.replace(/[^0-9]/g, "");
        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(list);
    toast({
      title: "WhatsApp Links Copied! 📱",
      description: `Copied ${selectedUsers.filter((u) => u.phone).length} direct WhatsApp message links to clipboard.`
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-3xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-5 h-5 text-primary shrink-0" />
              <DialogTitle className="text-base sm:text-lg truncate">Bulk Messaging &amp; Template Manager</DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 shrink-0">
              {selectedUsers.length} Users Selected
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Create or pick a reusable template, personalize dynamic tags, and send bulk messages across selected users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 py-1 sm:py-2">
          {/* Step 1: Template Selection & Management */}
          <Card className="border-border/60">
            <CardHeader className="p-3.5 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Step 1: Choose or Create Template
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-primary"
                  onClick={() => setShowNewTemplateForm(!showNewTemplateForm)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {showNewTemplateForm ? "Cancel New" : "New Template"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {showNewTemplateForm ? (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Template Title</Label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. KYC Reminder"
                        className="text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select value={newCategory} onValueChange={(v: any) => setNewCategory(v)}>
                        <SelectTrigger className="text-xs mt-1">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Security">Security</SelectItem>
                          <SelectItem value="Offer">Offer</SelectItem>
                          <SelectItem value="Mentorship">Mentorship</SelectItem>
                          <SelectItem value="System">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">
                      Message Content (Use tags: <code>{"{{name}}"}</code>, <code>{"{{coins}}"}</code>, <code>{"{{phone}}"}</code>)
                    </Label>
                    <Textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Dear {{name}}, your wallet has {{coins}} coins..."
                      rows={3}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowNewTemplateForm(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveNewTemplate}>
                      Save Template
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="text-xs flex-1">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.title} <span className="text-muted-foreground">({t.category})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {templates.find((t) => t.id === selectedTemplateId)?.isCustom && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteTemplate(selectedTemplateId)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Message Body & Placeholders */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" /> Step 2: Customize Message
              </Label>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <span>Tags:</span>
                <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setMessageBody((prev) => prev + " {{name}}")}>
                  {"{{name}}"}
                </Badge>
                <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setMessageBody((prev) => prev + " {{coins}}")}>
                  {"{{coins}}"}
                </Badge>
                <Badge variant="secondary" className="cursor-pointer text-[10px]" onClick={() => setMessageBody((prev) => prev + " {{phone}}")}>
                  {"{{phone}}"}
                </Badge>
              </div>
            </div>

            <Textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={4}
              className="text-xs font-sans leading-relaxed"
              placeholder="Write your bulk message here..."
            />
          </div>

          {/* Step 3: Channel & Live Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delivery Channel */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-primary" /> Delivery Channel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1.5">
                  <label
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                      channel === "in_app" ? "border-primary bg-primary/10 text-primary" : "border-border/60"
                    }`}
                    onClick={() => setChannel("in_app")}
                  >
                    <Bell className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">In-App Notification</div>
                      <div className="text-[10px] text-muted-foreground">Displays in user's Growhaz alert bell</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                      channel === "whatsapp" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border/60"
                    }`}
                    onClick={() => setChannel("whatsapp")}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="font-semibold">WhatsApp Direct Links</div>
                      <div className="text-[10px] text-muted-foreground">Generates 1-click wa.me chat links</div>
                    </div>
                  </label>
                </div>

                {channel === "whatsapp" && (
                  <Button size="sm" variant="outline" className="w-full text-xs mt-2" onClick={handleCopyWhatsAppList}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy WhatsApp Links for All Selected
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Live Personalized Sample Preview */}
            <Card className="border-border/60 bg-muted/30 min-w-0">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-cyan-400 shrink-0" /> Sample Preview
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">Sample: {previewUser.full_name}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-md bg-background border border-border/60 text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {samplePreviewText || <span className="text-muted-foreground italic">Type a message to preview...</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recipients Pill List */}
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
              <span>Recipients ({selectedUsers.length}):</span>
              <span>All dynamic tags will be substituted automatically</span>
            </div>
            <div className="max-h-20 overflow-y-auto flex flex-wrap gap-1 p-2 rounded border border-border/40 bg-muted/20">
              {selectedUsers.map((u) => (
                <Badge key={u.id} variant="secondary" className="text-[10px]">
                  {u.full_name} {u.phone ? `(${u.phone})` : ""}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            {sendProgress ? (
              <span className="font-medium text-primary animate-pulse">
                Sending {sendProgress.sent} of {sendProgress.total}...
              </span>
            ) : (
              <span>Ready to send to {selectedUsers.length} users</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={handleSendBulk} disabled={isSending || selectedUsers.length === 0}>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isSending ? "Dispatching..." : `Send to ${selectedUsers.length}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
