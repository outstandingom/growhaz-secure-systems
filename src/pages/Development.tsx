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
  {
    icon: Globe,
    title: "Business Websites",
    description: "Professional, conversion-focused websites that represent your brand.",
  },
  {
    icon: Layers,
    title: "Student & Management Systems",
    description: "Complete management solutions for educational institutions.",
  },
  {
    icon: LayoutDashboard,
    title: "Web Dashboards",
    description: "Interactive dashboards with real-time data visualization.",
  },
  {
    icon: Rocket,
    title: "SaaS Platforms",
    description: "Scalable software-as-a-service applications built for growth.",
  },
  {
    icon: Code2,
    title: "Custom Startup Web Apps",
    description: "Tailored solutions to meet unique business requirements.",
  },
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-6 rounded-2xl bg-card border border-border card-hover animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <service.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
              <p className="text-muted-foreground text-sm">{service.description}</p>
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
            <ul className="space-y-4">
              {keyFocus.map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative p-8 rounded-2xl bg-card border border-border">
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-medium">Secure Authentication</div>
                  <div className="text-sm text-muted-foreground">Implemented</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-medium">Input Validation</div>
                  <div className="text-sm text-muted-foreground">All endpoints secured</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="font-medium">Performance Score</div>
                  <div className="text-sm text-muted-foreground">98/100</div>
                </div>
              </div>
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
