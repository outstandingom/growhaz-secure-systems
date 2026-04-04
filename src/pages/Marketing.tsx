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
  { icon: TrendingUp, title: "Startup Digital Marketing" },
  { icon: Target, title: "SEO-Supported Marketing" },
  { icon: BarChart3, title: "Website Traffic Optimization" },
];

const approach = [
  "Measurable results, not vanity metrics",
  "Every effort backed by SEO for sustainable growth",
  "Transparent reporting and honest communication",
  "Budget-conscious strategies for startups",
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Approach */}
      <section className="section-container bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Our <span className="gradient-text">Approach</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {approach.map((item) => (
              <div key={item} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-center">{item}</span>
              </div>
            ))}
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
