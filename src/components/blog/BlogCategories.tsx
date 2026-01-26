import { cn } from "@/lib/utils";
import { 
  Shield, 
  Search, 
  Megaphone, 
  Brain, 
  Blocks, 
  Layers,
  LucideIcon
} from "lucide-react";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  icon: LucideIcon;
  color: string;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  { id: "all", name: "All Posts", slug: "all", icon: Layers, color: "text-primary" },
  { id: "security", name: "Security", slug: "security", icon: Shield, color: "text-red-500" },
  { id: "seo", name: "SEO", slug: "seo", icon: Search, color: "text-green-500" },
  { id: "marketing", name: "Marketing", slug: "marketing", icon: Megaphone, color: "text-blue-500" },
  { id: "ai-agents", name: "AI Agents", slug: "ai-agents", icon: Brain, color: "text-purple-500" },
  { id: "blockchain", name: "Blockchain", slug: "blockchain", icon: Blocks, color: "text-orange-500" },
];

interface BlogCategoriesProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  postCounts?: Record<string, number>;
}

export function BlogCategories({ 
  selectedCategory, 
  onCategoryChange,
  postCounts = {}
}: BlogCategoriesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {BLOG_CATEGORIES.map((category) => {
        const Icon = category.icon;
        const count = category.slug === "all" 
          ? Object.values(postCounts).reduce((a, b) => a + b, 0)
          : postCounts[category.slug] || 0;
        
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.slug)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
              selectedCategory === category.slug
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-card/80 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border"
            )}
          >
            <Icon className={cn(
              "w-4 h-4",
              selectedCategory === category.slug ? "text-primary-foreground" : category.color
            )} />
            <span>{category.name}</span>
            {count > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 text-xs rounded-full",
                selectedCategory === category.slug
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
