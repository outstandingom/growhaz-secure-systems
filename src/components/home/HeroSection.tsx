import { Link } from "react-router-dom";
import { Shield, ArrowRight, Sparkles, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl opacity-30" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Security-First Development</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Secure Your Website.{" "}
            <br className="hidden sm:block" />
            <span className="gradient-text">Build Smart Systems.</span>
            <br className="hidden sm:block" />
            Grow with GROWHAZ.
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            GROWHAZ helps startups and businesses test website security, build secure web applications, 
            rank on Google using SEO, and automate repetitive business tasks.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-2 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/security-tools" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="group w-full sm:w-auto">
                <Shield className="w-5 h-5" />
                Test Website Security
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/blockchain" className="w-full sm:w-auto">
              <Button variant="heroOutline" size="xl" className="w-full sm:w-auto">
                <FileCheck2 className="w-5 h-5" />
                Verify Document
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-16 border-t border-border animate-fade-in" style={{ animationDelay: "0.4s" }}>
            {[
              { value: "50+", label: "Projects Delivered" },
              { value: "100%", label: "Security Focus" },
              { value: "10+", label: "Active Tools" },
              { value: "24/7", label: "Support" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border">
                <span className="text-2xl md:text-3xl font-bold gradient-text">{stat.value}</span>
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
