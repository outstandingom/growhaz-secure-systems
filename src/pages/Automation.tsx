// src/pages/Automation.tsx

import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap,
  Smartphone,
  Search,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Bot,
  Workflow,
  Database,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ConverterModal } from "@/components/ConverterModal";
import { TitleMarquee } from "@/components/TitleMarquee";

type Tool = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  price: string;
  category: "automation" | "ai" | "workflow";
  url?: string;
  internal?: boolean;
  status?: "coming soon" | "new";
};

const tools: Tool[] = [
  {
    id: "web-to-apk",
    name: "Website to App Converter",
    description:
      "Turn any website into a native Android APK or iOS IPA. Customise with your own branding, splash screen, and features.",
    icon: Smartphone,
    price: "Free (5 credits)",
    category: "automation",
    internal: true,
    status: "new",
  },
  {
    id: "ai-social-poster",
    name: "AI Social Media Poster",
    description:
      "Automatically generate and post engaging content to Twitter, LinkedIn, and Facebook using AI.",
    icon: Bot,
    price: "$19/mo",
    category: "ai",
    url: "#",
    status: "coming soon",
  },
  // ... other tools remain unchanged
];

export default function Automation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isConverterOpen, setIsConverterOpen] = useState(false);

  const filteredTools = tools.filter((tool) =>
    `${tool.name} ${tool.description}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const handleToolClick = (tool: Tool) => {
    if (tool.internal) {
      setIsConverterOpen(true);
    } else if (tool.url && tool.url !== "#") {
      window.open(tool.url, "_blank");
    }
  };

  return (
    <Layout>
      {/* Hero Section – mobile-first padding & text sizing */}
      <section className="section-container px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">
              Tool Gallery
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
            Discover &amp; Sell{" "}
            <span className="gradient-text">Automated Tools</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2">
            Explore a curated collection of automation tools, AI workflows, and
            intelligent agents. Find the perfect solution to supercharge your
            productivity – or list your own and start earning.
          </p>

          {/* Search Bar – full width on mobile */}
          <div className="mt-6 sm:mt-8 max-w-md mx-auto relative px-2 sm:px-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tools, workflows, AI agents..."
              className="pl-10 h-11 sm:h-12 rounded-xl bg-card/50 border-border/60 focus:border-primary w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <TitleMarquee />
        </div>
      </section>

      {/* Tools Grid – responsive columns, gap, and card padding */}
      <section className="section-container px-4 sm:px-6 pt-0">
        {filteredTools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tools found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  className="group relative p-4 sm:p-6 rounded-2xl bg-card/50 border border-border hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col"
                >
                  {tool.status && (
                    <span className="absolute top-2 right-2 sm:top-3 sm:right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {tool.status}
                    </span>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-primary bg-primary/5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                      {tool.price}
                    </span>
                  </div>

                  <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold">
                    {tool.name}
                  </h3>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground flex-1">
                    {tool.description}
                  </p>

                  {/* Button – full width on mobile, inline on larger screens */}
                  <div className="mt-4 sm:mt-6">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full sm:w-auto rounded-full gap-1.5 text-sm"
                      onClick={() => handleToolClick(tool)}
                      disabled={tool.url === "#" && !tool.internal}
                    >
                      {tool.internal ? "Open Converter" : "Use Tool"}
                      {!tool.internal && tool.url !== "#" && (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA Section – mobile padding & full-width button */}
      <section className="section-container px-4 sm:px-6 bg-card/50">
        <div className="max-w-3xl mx-auto text-center py-4 sm:py-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
            Have a Tool to <span className="gradient-text">Sell</span>?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto px-2">
            Join our marketplace and reach thousands of users looking for
            automation solutions. We handle payment, hosting, and delivery.
          </p>
          <Link to="/contact" className="block sm:inline-block">
            <Button
              variant="hero"
              size="xl"
              className="w-full sm:w-auto justify-center"
            >
              Become a Seller
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Converter Modal – ensure it's mobile-friendly (modal component itself should be responsive) */}
      <ConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
      />
    </Layout>
  );
}
