import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Search,
  Code2,
  FileText,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";

const securityTools = [
  {
    name: "AlphaG1",
    price: "₹1,999",
    period: "per scan",
    description: "Basic security audit for small websites and personal projects.",
    features: [
      "SQL Injection testing",
      "XSS vulnerability scan",
      "Header validation",
      "TLS/SSL analysis",
      "Detailed report",
    ],
    popular: false,
    requiresApproval: false,
  },
  {
    name: "AlphaG2",
    price: "₹4,999",
    period: "per scan",
    description: "Advanced security audit for business websites and applications.",
    features: [
      "All AlphaG1 features",
      "IDOR vulnerability testing",
      "API security testing",
      "Authentication bypass checks",
      "Priority support",
    ],
    popular: true,
    requiresApproval: true,
  },
  {
    name: "AlphaG3",
    price: "₹9,999",
    period: "per scan",
    description: "Enterprise-grade penetration testing for critical systems.",
    features: [
      "All AlphaG2 features",
      "Full penetration testing",
      "Business logic testing",
      "Custom attack vectors",
      "Remediation consultation",
    ],
    popular: false,
    requiresApproval: true,
  },
];

const websitePackages = [
  {
    name: "Static Website",
    price: "₹20,000",
    period: "one-time",
    description: "Static website with 100% Lighthouse SEO score and security certified.",
    features: [
      "100% Lighthouse SEO score",
      "Passes all security tests",
      "Responsive design",
      "Fast loading (Core Web Vitals)",
      "3 months support",
    ],
    popular: false,
  },
  {
    name: "Dynamic Website",
    price: "₹60,000",
    period: "starting from",
    description: "Full CRUD operations (e-commerce, CRM, student management) with top scores.",
    features: [
      "100% Lighthouse SEO score",
      "Passes all security tests",
      "Create, Read, Update, Delete",
      "Admin dashboard",
      "6 months support",
    ],
    popular: true,
  },
  {
    name: "Custom Enterprise",
    price: "Contact Us",
    period: "",
    description: "Custom website design with advanced features tailored to your needs.",
    features: [
      "Custom design & branding",
      "Advanced integrations",
      "Scalable architecture",
      "Dedicated support team",
      "SLA guarantee",
    ],
    popular: false,
  },
];

const seoServices = [
  { 
    name: "Basic SEO", 
    price: "₹8,000",
    description: "Lighthouse 100%, Core Web Vitals optimized",
    note: "For websites with 3+ pages, contact us for custom quote"
  },
  { 
    name: "On-Page SEO", 
    price: "₹10,000/month",
    description: "Meta tags, content optimization, internal linking"
  },
  { 
    name: "Off-Page SEO", 
    price: "Contact Us",
    description: "Pricing depends on website scope and competition"
  },
];

const otherServices = [
  { name: "Student Management System", price: "₹5,000/month" },
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

      {/* Security Tools */}
      <section className="section-container pt-0">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 mb-4">
            <Shield className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Security Tools</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">
            Security <span className="gradient-text">Testing</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {securityTools.map((tool, index) => (
            <div
              key={tool.name}
              className={`relative p-6 rounded-2xl border animate-fade-in ${
                tool.popular
                  ? "bg-gradient-to-b from-primary/10 to-card border-primary"
                  : "bg-card border-border"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {tool.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{tool.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">{tool.price}</span>
                <span className="text-muted-foreground ml-1">{tool.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{tool.description}</p>

              {tool.requiresApproval && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-500">
                    Requires company approval letter from Manager/CEO
                  </span>
                </div>
              )}

              <ul className="space-y-3 mb-8">
                {tool.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tool.popular ? "hero" : "outline"}
                className="w-full"
                asChild
              >
                <Link to="/security-tools">
                  {tool.requiresApproval ? "Request Access" : "Start Scan"}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Website Packages */}
      <section className="section-container bg-card/50">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Website Development</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold">
            Website <span className="gradient-text">Packages</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {websitePackages.map((pkg, index) => (
            <div
              key={pkg.name}
              className={`relative p-6 rounded-2xl border animate-fade-in ${
                pkg.popular
                  ? "bg-gradient-to-b from-primary/10 to-card border-primary"
                  : "bg-card border-border"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{pkg.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">{pkg.price}</span>
                {pkg.period && (
                  <span className="text-muted-foreground ml-1">{pkg.period}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6">{pkg.description}</p>

              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={pkg.popular ? "hero" : "outline"}
                className="w-full"
                asChild
              >
                <Link to="/contact">
                  {pkg.price === "Contact Us" ? "Get Quote" : "Get Started"}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* SEO Services */}
      <section className="section-container">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Search className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">SEO Services</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">
              SEO <span className="gradient-text">Optimization</span>
            </h2>
          </div>

          <div className="space-y-4">
            {seoServices.map((service) => (
              <div
                key={service.name}
                className="p-5 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-primary font-bold">{service.price}</span>
                </div>
                <p className="text-sm text-muted-foreground">{service.description}</p>
                {service.note && (
                  <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {service.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other Services */}
      <section className="section-container bg-card/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Other <span className="gradient-text">Services</span>
          </h2>

          <div className="space-y-4">
            {otherServices.map((service) => (
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
