import { Link } from "react-router-dom";
import { ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const projects = [
  {
    title: "Student Management System",
    category: "Web App",
    description: "Complete student management with on-page SEO implementation.",
    url: "https://outstandingom.github.io/Stumanagement.github.io/",
    image: "/placeholder.svg",
  },
  {
    title: "Agriculture Web App",
    category: "Web App",
    description: "SEO-optimized agriculture platform with smart UI structure.",
    url: "https://outstandingom.github.io/Agritech.github.io/",
    image: "/placeholder.svg",
  },
  {
    title: "Khandelwal Borewells",
    category: "Business Website",
    description: "Ranking for multiple borewell service keywords in Bhopal.",
    url: "https://khandelwalborewells.in",
    image: "/placeholder.svg",
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {projects.map((project, index) => (
          <article
            key={project.title}
            className="group rounded-2xl bg-card border border-border overflow-hidden card-hover animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Image */}
            <div className="aspect-video bg-secondary relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-muted-foreground/30">
                  {project.title.charAt(0)}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-xs font-medium text-primary mb-2">{project.category}</div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
              
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Visit Live Site
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </article>
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
