import { Link } from "react-router-dom";
import { Shield, Code2, Search, Zap, Megaphone, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Shield,
    title: "Security Tools",
    description: "Real, usable website security testing tools to identify vulnerabilities before attackers do.",
    href: "/security-tools",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: Code2,
    title: "Website Development",
    description: "Secure & scalable website development for business websites, dashboards, and SaaS platforms.",
    href: "/development",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Search,
    title: "SEO Optimization",
    description: "On-page & off-page SEO optimization to help your business rank higher on Google.",
    href: "/seo",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon: Zap,
    title: "Automation Tools",
    description: "Automation tools for repetitive startup tasks like posting, data processing, and workflows.",
    href: "/automation",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Megaphone,
    title: "Digital Marketing",
    description: "Performance-focused digital marketing services with SEO-supported strategies.",
    href: "/marketing",
    color: "from-pink-500 to-rose-500",
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <Link
            key={service.title}
            to={service.href}
            className="group relative p-6 rounded-2xl bg-card border border-border card-hover animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <service.icon className="w-6 h-6 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
              {service.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {service.description}
            </p>

            {/* Arrow */}
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              Learn more
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
