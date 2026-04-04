import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Info, 
  Shield,
  Code2,
  Search,
  Zap,
  ArrowRight,
  Target,
  CheckCircle2
} from "lucide-react";
import { Link } from "react-router-dom";

const values = [
  { icon: Shield, title: "Security First" },
  { icon: Code2, title: "Real Development" },
  { icon: Search, title: "SEO Results" },
  { icon: Zap, title: "Automation Focus" },
];

const stats = [
  { value: "50+", label: "Projects Delivered" },
  { value: "100%", label: "Security Focus" },
  { value: "10+", label: "Active Tools" },
  { value: "5+", label: "Years Experience" },
];

const mission = [
  "Security testing tools that identify real vulnerabilities",
  "Real startup systems that solve actual problems",
  "SEO-optimized websites that rank and convert",
  "Automation tools that save time and reduce errors",
];

export default function About() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Info className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">About Us</span>
          </div>
          
          <h1 className="section-title mb-6">
            About <span className="gradient-text">GROWHAZ</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            GROWHAZ focuses on security, real development, SEO results, and automation — not theory.
            We build solutions that actually work.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto">
          <div className="p-8 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We believe that every startup and business deserves access to secure, well-built technology.
              Our mission is to provide real, tangible solutions that help businesses grow securely and efficiently.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mission.map((item) => (
                <div key={item} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-center">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-container bg-card/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            What We <span className="gradient-text">Stand For</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {values.map((value, index) => (
            <div
              key={value.title}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <value.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">{value.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="section-container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
              <span className="text-2xl md:text-3xl font-bold gradient-text">{stat.value}</span>
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Work Together?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Let's discuss how GROWHAZ can help your business grow securely.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Get in Touch
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
