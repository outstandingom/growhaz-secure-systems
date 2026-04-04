import { Link } from "react-router-dom";
import { ExternalLink, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const projects = [
  {
    title: "Student Management System",
    category: "Web App",
    description: "Complete student management with on-page SEO implementation.",
    url: "https://outstandingom.github.io/Stumanagement.github.io/",
  },
  {
    title: "Agriculture Web App",
    category: "Web App",
    description: "SEO-optimized agriculture platform with smart UI structure.",
    url: "https://outstandingom.github.io/Agritech.github.io/",
  },
  {
    title: "Khandelwal Borewells",
    category: "Business Website",
    description: "Ranking for multiple borewell service keywords in Bhopal.",
    url: "https://khandelwalborewells.in",
  },
];

export function ProjectsPreview() {
  return (
    <section className="section-container bg-card/50">
      <div className="text-center mb-12">
        <h2 className="section-title mb-4">
          Real <span className="gradient-text">Working Projects</span>
        </h2>
        <p className="section-subtitle mx-auto">
          These are not mockups — these are real, deployed systems that our clients use every day.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {projects.map((project, index) => (
          <div
            key={project.title}
            className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card/50 border border-border hover:border-primary/40 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Globe className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium text-primary">{project.category}</span>
            <h3 className="text-base font-semibold text-center">{project.title}</h3>
            <p className="text-sm text-muted-foreground text-center">{project.description}</p>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline mt-auto"
            >
              Visit Live Site
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ))}
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
