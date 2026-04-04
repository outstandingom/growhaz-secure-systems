import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Code2, 
  Shield, 
  Zap, 
  Cloud, 
  Layers,
  CheckCircle2,
  ArrowRight,
  Globe,
  LayoutDashboard,
  Rocket
} from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  { icon: Globe, title: "Business Websites" },
  { icon: Layers, title: "Student & Management Systems" },
  { icon: LayoutDashboard, title: "Web Dashboards" },
  { icon: Rocket, title: "SaaS Platforms" },
  { icon: Code2, title: "Custom Startup Web Apps" },
];

const keyFocus = [
  { icon: Shield, text: "Security-first development" },
  { icon: Zap, text: "Fast & responsive UI" },
  { icon: Code2, text: "Clean backend architecture" },
  { icon: Globe, text: "SEO-ready structure" },
  { icon: Cloud, text: "Scalable cloud deployment" },
];

export default function Development() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Development Services</span>
          </div>
          
          <h1 className="section-title mb-6">
            Secure & Scalable{" "}
            <span className="gradient-text">Website Development</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We build secure, fast, and scalable web applications that help your business grow.
            From simple websites to complex SaaS platforms.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section-container pt-0">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <service.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-center">{service.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Key Focus */}
      <section className="section-container bg-card/50">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Our Development <span className="gradient-text">Focus</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              Every project we build follows strict standards for security, performance, 
              and maintainability. Here's what sets our development apart:
            </p>
            <div className="grid grid-cols-2 gap-4">
              {keyFocus.map((item) => (
                <div key={item.text} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                  <item.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-center">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative p-8 rounded-2xl bg-card border border-border">
            <div className="space-y-6">
              {[
                { label: "Secure Authentication", sub: "Implemented" },
                { label: "Input Validation", sub: "All endpoints secured" },
                { label: "Performance Score", sub: "98/100" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10 opacity-50" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Build Your Project?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Let's discuss your requirements and create a secure, scalable solution for your business.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Start Your Project
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
