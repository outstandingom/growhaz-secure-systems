import { Link } from "react-router-dom";
import { Shield, Zap, ArrowRight, FileCheck2 } from "lucide-react";

const services = [
  {
    icon: Shield,
    title: "Security Tools",
    description: "Real, usable website security testing tools to identify vulnerabilities before attackers do.",
    href: "/security-tools",
  },
  {
    icon: FileCheck2,
    title: "Blockchain Verification",
    description: "AI + blockchain document authentication with knowledge-graph reasoning.",
    href: "/blockchain",
  },
  {
    icon: Zap,
    title: "Automation Tools",
    description: "Automation tools for repetitive startup tasks like posting, data processing, and workflows.",
    href: "/automation",
  },
];

export function ServicesOverview() {
  return (
    <section className="section-container">
      <div className="text-center mb-16">
        <h2 className="section-title mb-4">
          Everything You Need to <span className="gradient-text">Grow Securely</span>
        </h2>
        <p className="section-subtitle mx-auto">
          From security testing to marketing, we provide end-to-end solutions for startups and businesses.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {services.map((service, index) => (
          <Link
            key={service.title}
            to={service.href}
            className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-card/50 border border-border hover:border-primary/40 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <service.icon className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-center">{service.title}</span>
            <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </section>
  );
}
