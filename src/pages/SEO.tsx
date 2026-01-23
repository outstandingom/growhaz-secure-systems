import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  CheckCircle2, 
  ExternalLink,
  ArrowRight,
  Globe,
  TrendingUp,
  FileText,
  Link as LinkIcon
} from "lucide-react";
import { Link } from "react-router-dom";

const onPageSEO = [
  "Meta tags optimization",
  "Page structure optimization",
  "Keyword research & optimization",
  "Performance optimization",
  "Mobile-first indexing",
];

const offPageSEO = [
  "Quality backlink building",
  "Local SEO optimization",
  "Google ranking strategy",
  "Domain authority building",
  "Content marketing",
];

const projects = [
  {
    title: "Student Management System",
    url: "https://outstandingom.github.io/Stumanagement.github.io/",
    description: "On-page SEO implemented. Structure & performance optimized.",
    status: "SEO Implemented",
  },
  {
    title: "Agriculture Web App",
    url: "https://outstandingom.github.io/Agritech.github.io/",
    description: "On-page SEO done. SEO-friendly UI structure.",
    status: "SEO Optimized",
  },
  {
    title: "Khandelwal Borewells",
    url: "https://khandelwalborewells.in",
    description: "Ranking for multiple keywords with only basic SEO.",
    status: "Ranking Live",
    keywords: [
      "Best borewell services in Bhopal",
      "Borewell services in Neelbad",
      "Borewell services in Ratibad",
      "Borewell services in Sehore",
    ],
  },
  {
    title: "Sakuntala Website",
    url: "https://outstandingom.github.io/Sakuntala.guthub.io/",
    description: "Domain acquisition handled. SEO-ready domain planning.",
    status: "Domain Ready",
  },
  {
    title: "Land Measurement Website",
    url: "https://outstandingom.github.io/Location.guthub.io/",
    description: "SEO-friendly location-based structure implemented.",
    status: "SEO Structure",
  },
  {
    title: "Restaurant Website",
    url: "https://outstandingom.github.io/not.github.io/",
    description: "JaiswalRestaurant.com branding reference.",
    status: "Branding Done",
  },
];

export default function SEO() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Search className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">SEO Services</span>
          </div>
          
          <h1 className="section-title mb-6">
            SEO Optimization —{" "}
            <span className="gradient-text">On-Page & Off-Page</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Proven SEO strategies that help your business rank higher on Google.
            Real results from real projects.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="section-container pt-0">
        <div className="grid md:grid-cols-2 gap-8">
          {/* On-Page SEO */}
          <div className="p-8 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mb-6">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4">On-Page SEO</h2>
            <ul className="space-y-3">
              {onPageSEO.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Off-Page SEO */}
          <div className="p-8 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-6">
              <LinkIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Off-Page SEO</h2>
            <ul className="space-y-3">
              {offPageSEO.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Real SEO Projects */}
      <section className="section-container bg-card/50">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            📊 Real SEO <span className="gradient-text">Projects</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            These projects prove that ranking is possible even with basic SEO when structure is correct.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={project.title}
              className="p-6 rounded-2xl bg-card border border-border card-hover animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">{project.status}</span>
              </div>
              
              <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
              
              {project.keywords && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-foreground mb-2">Ranking Keywords:</div>
                  <ul className="space-y-1">
                    {project.keywords.map((keyword) => (
                      <li key={keyword} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        {keyword}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Visit Site
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Rank Higher on Google?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Let's analyze your website and create an SEO strategy that delivers real results.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Get SEO Analysis
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
