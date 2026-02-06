import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Send,
  CheckCircle2,
  Shield,
  Code2,
  Search,
  Zap,
  Loader2
} from "lucide-react";

const EMAILJS_SERVICE_ID = "service_j7j2dkv";
const EMAILJS_TEMPLATE_ID = "template_yzlkk7b";
const EMAILJS_PUBLIC_KEY = "6SXFvxC9yntvDF-Ra";

const services = [
  { id: "security", label: "Security Testing", icon: Shield },
  { id: "development", label: "Website Development", icon: Code2 },
  { id: "seo", label: "SEO Optimization", icon: Search },
  { id: "automation", label: "Automation", icon: Zap },
];

export default function Contact() {
  const [selectedService, setSelectedService] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setLoading(true);

    const formData = new FormData(formRef.current);
    const templateParams = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      website: formData.get("website") as string || "",
      message: formData.get("message") as string,
      service: services.find(s => s.id === selectedService)?.label || "Not specified",
      time: new Date().toLocaleString(),
    };

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      setSubmitted(true);
      toast({
        title: "Message Sent!",
        description: "We'll get back to you within 24 hours.",
      });
    } catch (error) {
      console.error("EmailJS error:", error);
      toast({
        title: "Failed to send",
        description: "Please try again or email us directly.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Contact Us</span>
          </div>
          
          <h1 className="section-title mb-6">
            Let's <span className="gradient-text">Talk</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ready to secure your website, build something amazing, or automate your business?
            We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="section-container pt-0">
        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <div className="text-center p-12 rounded-2xl bg-card border border-border">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Message Sent!</h2>
              <p className="text-muted-foreground mb-8">
                Thank you for reaching out. We'll get back to you within 24 hours.
              </p>
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="p-8 rounded-2xl bg-card border border-border">
              {/* Service Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">
                  What service are you interested in?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedService(service.id)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedService === service.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <service.icon className={`w-5 h-5 mb-2 ${
                        selectedService === service.id ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium">{service.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="mb-6">
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Doe"
                />
              </div>

              {/* Email */}
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="john@example.com"
                />
              </div>

              {/* Website URL */}
              <div className="mb-6">
                <label htmlFor="website" className="block text-sm font-medium mb-2">
                  Website URL (optional)
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              {/* Message */}
              <div className="mb-8">
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Your Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Tell us about your project or requirements..."
                />
              </div>

              <Button variant="hero" size="xl" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Message
                    <Send className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* Contact Info */}
      <section className="section-container bg-card/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Other Ways to Reach Us</h2>
          <p className="text-muted-foreground mb-6">
            Prefer to reach out directly? Send us an email at:
          </p>
          <a
            href="mailto:contact@growhaz.com"
            className="inline-flex items-center gap-2 text-lg font-medium text-primary hover:underline"
          >
            <Mail className="w-5 h-5" />
            contact@growhaz.com
          </a>
        </div>
      </section>
    </Layout>
  );
}
