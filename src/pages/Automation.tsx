import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Send,
  Database,
  GitBranch,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";

const automationTypes = [
  { icon: Send, title: "Daily Posting Automation" },
  { icon: Database, title: "Data Processing Automation" },
  { icon: GitBranch, title: "Workflow Automation" },
  { icon: Settings, title: "Custom Automation Tools" },
];

const benefits = [
  "Save hours of manual work every day",
  "Reduce human errors in repetitive tasks",
  "Scale operations without adding headcount",
  "Focus on high-value activities",
  "24/7 automated operations",
];

export default function Automation() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Automation Tools</span>
          </div>
          
          <h1 className="section-title mb-6">
            Automation for{" "}
            <span className="gradient-text">Repetitive Startup Tasks</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            GROWHAZ builds automation tools for startups that perform repetitive daily work.
            Focus on growth while we automate the rest.
          </p>
        </div>
      </section>

      {/* Automation Types */}
      <section className="section-container pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {automationTypes.map((item, index) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <item.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-center">{item.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="section-container bg-card/50">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Why <span className="gradient-text">Automate</span>?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-center">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative p-8 rounded-2xl bg-card border border-border">
            <div className="space-y-4 font-mono text-sm">
              <div className="text-muted-foreground">// Automation Example</div>
              <div className="text-primary">const automation = {"{"}</div>
              <div className="pl-4 text-foreground">schedule: "every day at 9am",</div>
              <div className="pl-4 text-foreground">task: "post to social media",</div>
              <div className="pl-4 text-foreground">platforms: ["twitter", "linkedin"],</div>
              <div className="pl-4 text-foreground">status: <span className="text-emerald-400">"running"</span></div>
              <div className="text-primary">{"}"}</div>
              
              <div className="mt-6 p-4 rounded-xl bg-card/50 border border-border">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>3,847 tasks automated this month</span>
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-3xl blur-2xl -z-10 opacity-50" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Automate Your Business?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Tell us about your repetitive tasks and we'll build custom automation solutions for you.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Automate My Business Tasks
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
