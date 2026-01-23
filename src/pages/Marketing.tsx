import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Megaphone, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Target,
  BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  {
    icon: TrendingUp,
    title: "Startup Digital Marketing",
    description: "Tailored marketing strategies designed specifically for startups and growing businesses.",
  },
  {
    icon: Target,
    title: "SEO-Supported Marketing",
    description: "Marketing campaigns backed by solid SEO foundations for long-term growth.",
  },
  {
    icon: BarChart3,
    title: "Website Traffic Optimization",
    description: "Data-driven strategies to increase and convert your website traffic.",
  },
];

export default function Marketing() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Megaphone className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Marketing Services</span>
          </div>
          
          <h1 className="section-title mb-6">
            Performance-Focused{" "}
            <span className="gradient-text">Digital Marketing</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Honest, results-driven digital marketing that focuses on real growth metrics.
            No fluff, just results.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="section-container pt-0">
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-6 rounded-2xl bg-card border border-border card-hover animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <service.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
              <p className="text-muted-foreground text-sm">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Approach */}
      <section className="section-container bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Our <span className="gradient-text">Approach</span>
          </h2>
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                We focus on measurable results, not vanity metrics
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Every marketing effort is backed by SEO for sustainable growth
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Transparent reporting and honest communication
              </span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Budget-conscious strategies for startups
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Let's Grow Your Business
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Get a marketing strategy tailored to your business goals and budget.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Get Marketing Consultation
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
