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
  {
    icon: Shield,
    title: "Security First",
    description: "Security is not an afterthought — it's the foundation of everything we build.",
  },
  {
    icon: Code2,
    title: "Real Development",
    description: "We build real, working systems that solve actual business problems.",
  },
  {
    icon: Search,
    title: "SEO Results",
    description: "Our SEO strategies deliver measurable ranking improvements.",
  },
  {
    icon: Zap,
    title: "Automation Focus",
    description: "We automate repetitive tasks so you can focus on growth.",
  },
];

const stats = [
  { value: "50+", label: "Projects Delivered" },
  { value: "100%", label: "Security Focus" },
  { value: "10+", label: "Active Tools" },
  { value: "5+", label: "Years Experience" },
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Target className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We believe that every startup and business deserves access to secure, well-built technology.
              Our mission is to provide real, tangible solutions that help businesses grow securely and efficiently.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Security testing tools that identify real vulnerabilities</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Real startup systems that solve actual problems</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">SEO-optimized websites that rank and convert</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Automation tools that save time and reduce errors</span>
              </li>
            </ul>
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

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <div
              key={value.title}
              className="text-center p-6 rounded-2xl bg-card border border-border animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <value.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="section-container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
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
