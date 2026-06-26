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
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";

// Define the shape of a tool
type Tool = {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  price: string; // e.g., "Free", "$9.99", "100 credits"
  category: "automation" | "ai" | "workflow";
  url: string; // external link or internal route
  status?: "coming soon" | "new";
};

// Sample tool data – add your products here
const tools: Tool[] = [
  {
    id: "web-to-apk",
    name: "Website to App Converter",
    description:
      "Turn any website into a native Android APK or iOS IPA. Customise with your own branding, splash screen, and features.",
    icon: Smartphone,
    price: "Free (5 credits)",
    category: "automation",
    url: "https://appify-your-website.vercel.app/",
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
    url: "#", // placeholder
    status: "coming soon",
  },
  {
    id: "data-cleaner",
    name: "Data Cleaning Workflow",
    description:
      "Automated pipeline to clean, deduplicate, and enrich your CSV/Excel data with zero code.",
    icon: Database,
    price: "$49 one-time",
    category: "workflow",
    url: "#",
  },
  {
    id: "lead-scraper",
    name: "Lead Scraper Agent",
    description:
      "AI agent that scrapes LinkedIn, company websites, and Crunchbase to generate high-quality leads.",
    icon: Workflow,
    price: "$99/mo",
    category: "ai",
    url: "#",
  },
  // Add more tools as you build them
];

export default function Automation() {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter tools based on search (name, description)
  const filteredTools = tools.filter((tool) =>
    `${tool.name} ${tool.description}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      {/* Hero Section */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Tool Gallery
            </span>
          </div>

          <h1 className="section-title mb-6">
            Discover &amp; Sell{" "}
            <span className="gradient-text">Automated Tools</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore a curated collection of automation tools, AI workflows, and
            intelligent agents. Find the perfect solution to supercharge your
            productivity – or list your own and start earning.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tools, workflows, AI agents..."
              className="pl-10 h-11 rounded-xl bg-card/50 border-border/60 focus:border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="section-container pt-0">
        {filteredTools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tools found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  className="group relative p-6 rounded-2xl bg-card/50 border border-border hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col"
                >
                  {/* Status badge */}
                  {tool.status && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {tool.status}
                    </span>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium text-primary bg-primary/5 px-3 py-1 rounded-full">
                      {tool.price}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-semibold">{tool.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground flex-1">
                    {tool.description}
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-full gap-1.5"
                      onClick={() => window.open(tool.url, "_blank")}
                    >
                      Use Tool
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    {/* Optional "Learn More" link */}
                    <Button variant="ghost" size="sm" className="rounded-full">
                      Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sell Your Own Tool CTA */}
      <section className="section-container bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Have a Tool to <span className="gradient-text">Sell</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join our marketplace and reach thousands of users looking for
            automation solutions. We handle payment, hosting, and delivery.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Become a Seller
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
