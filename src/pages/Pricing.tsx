import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  CheckCircle2, 
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const products = [
  {
    name: "Student Management System",
    price: "₹5,000",
    period: "/ month",
    description: "Complete student management solution for educational institutions.",
    features: [
      "Full system access",
      "Integration support",
      "Basic customization",
      "Monthly usage",
      "Email support",
    ],
    popular: true,
  },
  {
    name: "Security Audit",
    price: "₹15,000",
    period: "one-time",
    description: "Comprehensive security audit for your web application.",
    features: [
      "Full vulnerability scan",
      "Detailed report",
      "Fix recommendations",
      "30-day support",
      "Re-scan included",
    ],
    popular: false,
  },
  {
    name: "Website Development",
    price: "₹25,000",
    period: "starting from",
    description: "Custom website development with security-first approach.",
    features: [
      "Custom design",
      "Responsive layout",
      "SEO optimization",
      "Security features",
      "3 months support",
    ],
    popular: false,
  },
];

const services = [
  { name: "Basic SEO Audit", price: "₹5,000" },
  { name: "On-Page SEO", price: "₹10,000/month" },
  { name: "Off-Page SEO", price: "₹15,000/month" },
  { name: "Automation Setup", price: "₹8,000+" },
  { name: "Custom Development", price: "Contact us" },
];

export default function Pricing() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Pricing</span>
          </div>
          
          <h1 className="section-title mb-6">
            Products & <span className="gradient-text">Pricing</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transparent pricing for all our products and services.
            No hidden fees, no surprises.
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="section-container pt-0">
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <div
              key={product.name}
              className={`relative p-6 rounded-2xl border animate-fade-in ${
                product.popular
                  ? "bg-gradient-to-b from-primary/10 to-card border-primary"
                  : "bg-card border-border"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {product.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">{product.price}</span>
                <span className="text-muted-foreground ml-1">{product.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{product.description}</p>

              <ul className="space-y-3 mb-8">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <Button
                  variant={product.popular ? "hero" : "outline"}
                  className="w-full"
                >
                  Buy Now
                </Button>
                <Button variant="ghost" className="w-full text-sm">
                  Request Integration
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services Pricing */}
      <section className="section-container bg-card/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Service <span className="gradient-text">Pricing</span>
          </h2>

          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
              >
                <span className="font-medium">{service.name}</span>
                <span className="text-primary font-semibold">{service.price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Need Custom Pricing?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Every business is unique. Contact us for a custom quote tailored to your needs.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Get Custom Quote
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
