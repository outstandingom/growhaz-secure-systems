import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { 
  Layers, 
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const projects = [
  {
    title: "Student Management System",
    category: "Web Application",
    description: "Complete student management solution with on-page SEO implementation. Features student records, attendance, and grade management.",
    url: "https://outstandingom.github.io/Stumanagement.github.io/",
    tags: ["React", "SEO", "Dashboard"],
  },
  {
    title: "Agriculture Web App",
    category: "Web Application",
    description: "SEO-optimized agriculture platform with smart UI structure. Helps farmers manage crops and resources efficiently.",
    url: "https://outstandingom.github.io/Agritech.github.io/",
    tags: ["Agriculture", "SEO", "Data Visualization"],
  },
  {
    title: "Khandelwal Borewells",
    category: "Business Website",
    description: "Professional business website ranking for multiple borewell service keywords in Bhopal. Proven SEO success.",
    url: "https://khandelwalborewells.in",
    tags: ["Business", "SEO", "Local Search"],
  },
  {
    title: "Restaurant Website",
    category: "Business Website",
    description: "JaiswalRestaurant.com branding reference. Modern restaurant website with menu and booking features.",
    url: "https://outstandingom.github.io/not.github.io/",
    tags: ["Restaurant", "Branding", "UI/UX"],
  },
  {
    title: "Land Measurement Website",
    category: "Tool",
    description: "SEO-friendly location-based structure for land measurement and mapping services.",
    url: "https://outstandingom.github.io/Location.guthub.io/",
    tags: ["Location", "Maps", "Tools"],
  },
  {
    title: "Sakuntala Website",
    category: "Domain Planning",
    description: "Domain acquisition and SEO-ready domain planning for cultural content platform.",
    url: "https://outstandingom.github.io/Sakuntala.guthub.io/",
    tags: ["Domain", "Planning", "SEO"],
  },
  {
    title: "Salon Finder App",
    category: "Mobile App",
    description: "Location-based salon finder application with booking and review features.",
    url: "#",
    tags: ["Mobile", "Location", "Booking"],
  },
  {
    title: "TripShare App",
    category: "Mobile App",
    description: "Travel sharing platform connecting travelers and enabling group trip planning.",
    url: "#",
    tags: ["Travel", "Social", "Planning"],
  },
  {
    title: "Smart Agriculture App",
    category: "IoT Application",
    description: "IoT-enabled agriculture monitoring with smart sensors and analytics.",
    url: "#",
    tags: ["IoT", "Agriculture", "Analytics"],
  },
];

export default function Projects() {
  return (
    <Layout>
      {/* Hero */}
      <section className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Portfolio</span>
          </div>
          
          <h1 className="section-title mb-6">
            Our Real <span className="gradient-text">Working Projects</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            These are not mockups — these are real, deployed systems that our clients use every day.
            Every project represents our commitment to quality and results.
          </p>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="section-container pt-0">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <article
              key={project.title}
              className="group rounded-2xl bg-card border border-border overflow-hidden card-hover animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Image */}
              <div className="aspect-video bg-secondary relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-bold text-muted-foreground/20">
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
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs rounded-md bg-secondary text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                
                {project.url !== "#" && (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Visit Live Site
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-container">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Want to Be Our Next Success Story?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Let's discuss your project and create something amazing together.
          </p>
          <Link to="/contact">
            <Button variant="hero" size="xl">
              Start Your Project
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
