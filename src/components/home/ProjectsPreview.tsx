import { Link } from "react-router-dom";
import { ExternalLink, ArrowRight, Globe, Loader2, Brain, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

// ---- Client websites (live metadata will be fetched) ----
const clientUrls = [
  {
    id: "prayas",
    url: "https://prayassamajsevisanstha.org/",
    category: "Non-Profit Website",
  },
  {
    id: "khandelwal",
    url: "https://khandelwalborewells.in/",
    category: "Business Website",
  },
  {
    id: "dinesh",
    url: "https://www.dineshjagwanicinematographyacademy.com/",
    category: "Educational Website",
  },
  {
    id: "jaiswal",
    url: "https://jaiswalrestaurant.com/",
    category: "Restaurant Website",
  },
];

// ---- Your own AI / knowledge‑graph projects (static data from resume) ----
const internalProjects = [
  {
    id: "dna-agent",
    title: "AI Cognitive Agent with DNA‑Inspired Memory",
    category: "AI Agent",
    description:
      "Vector‑based memory architecture mimicking DNA’s short‑term and long‑term encoding. Uses PostgreSQL vector extensions for persistent semantic retrieval and adaptive decision‑making.",
    icon: Brain,
    link: "#", // optionally add a demo / GitHub link
  },
  {
    id: "kg-verification",
    title: "AI Document Verification with Blockchain + Knowledge Graph",
    category: "Security & AI",
    description:
      "Dual‑hash (file + content) and knowledge‑graph entity extraction to detect tampering and semantic fraud. Flags logical inconsistencies beyond hash‑only checks.",
    icon: Shield,
    link: "#",
  },
];

// Helper to fetch metadata from microlink.io
async function fetchMetadata(url: string) {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("Failed to fetch metadata");
  const data = await res.json();
  return data.data;
}

export function ProjectsPreview() {
  // State for client projects (with loading)
  const [clientProjects, setClientProjects] = useState(
    clientUrls.map((p) => ({
      ...p,
      title: p.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      description: "Loading metadata…",
      image: "",
      loading: true,
      error: false,
    }))
  );

  // Fetch metadata for client sites
  useEffect(() => {
    clientUrls.forEach(async (p, index) => {
      try {
        const meta = await fetchMetadata(p.url);
        setClientProjects((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            title: meta.title || updated[index].title,
            description: meta.description || meta.title || "Live website with modern UI/UX.",
            image: meta.image?.url || "",
            loading: false,
          };
          return updated;
        });
      } catch {
        setClientProjects((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            description: "Visit the site to explore its content.",
            loading: false,
            error: true,
          };
          return updated;
        });
      }
    });
  }, []);

  // Combine: client projects (after fetch) + internal projects (static)
  const allProjects = [
    ...clientProjects.map((p) => ({ ...p, isClient: true })),
    ...internalProjects.map((p) => ({ ...p, isClient: false, loading: false })),
  ];

  return (
    <section className="section-container bg-card/50">
      <div className="text-center mb-12">
        <h2 className="section-title mb-4">
          Real <span className="gradient-text">Working Projects</span>
        </h2>
        <p className="section-subtitle mx-auto">
          Client deployments and my own AI / security innovations — all built with production‑grade engineering.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {allProjects.map((project, index) => {
          const Icon = project.icon || Globe;
          return (
            <div
              key={project.id}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card/50 border border-border hover:border-primary/40 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {project.isClient && project.image ? (
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-32 object-cover rounded-md mb-2"
                />
              ) : (
                <Icon className="w-8 h-8 text-primary" />
              )}
              <span className="text-xs font-medium text-primary">{project.category}</span>
              <h3 className="text-base font-semibold text-center">{project.title}</h3>
              <p className="text-sm text-muted-foreground text-center flex-1">
                {project.loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  project.description
                )}
              </p>
              {project.isClient ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline mt-auto"
                >
                  Visit Live Site
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground mt-auto">AI / R&D Project</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <Link to="/projects">
          <Button variant="hero" size="lg" className="group">
            View All Projects
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
