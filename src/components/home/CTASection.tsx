import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="section-container">
      <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 p-8 md:p-12 lg:p-16 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Ready to Get Started?</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Let's Build Something{" "}
            <span className="gradient-text">Secure & Scalable</span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Whether you need a security audit, a new website, or automation tools — GROWHAZ has you covered.
            Get in touch today and let's discuss your project.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group">
                Get a Free Consultation
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/security-tools">
              <Button variant="heroOutline" size="xl">
                <Shield className="w-5 h-5" />
                Try Security Scanner
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
