import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight, Tag } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BLOG_CATEGORIES } from "./BlogCategories";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  author_name: string;
  tags: string[];
  category: string;
  published_at: string;
}

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  const getReadTime = (excerpt: string) => {
    const wordsPerMinute = 200;
    const wordCount = excerpt.split(" ").length * 5;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  };

  const categoryInfo = BLOG_CATEGORIES.find(c => c.slug === post.category);
  const CategoryIcon = categoryInfo?.icon || Tag;

  return (
    <article
      className={cn(
        "group rounded-2xl bg-card/80 backdrop-blur-sm border border-border overflow-hidden card-hover",
        featured && "md:col-span-2 lg:col-span-2"
      )}
    >
      <Link to={`/blog/${post.slug}`} className="block">
        {/* Featured Image */}
        <div className={cn(
          "relative bg-gradient-to-br from-primary/20 to-accent/20",
          featured ? "h-48 sm:h-64" : "h-44 sm:h-48"
        )}>
          {post.featured_image ? (
            <img
              src={post.featured_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CategoryIcon className={cn("w-8 h-8", categoryInfo?.color || "text-primary")} />
              </div>
            </div>
          )}
          
          {/* Category & Tags overlay */}
          <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex gap-1.5 sm:gap-2 flex-wrap">
            {categoryInfo && (
              <span className={cn(
                "px-2.5 py-1 text-xs font-semibold bg-background/95 backdrop-blur-sm rounded-full flex items-center gap-1.5",
                categoryInfo.color
              )}>
                <CategoryIcon className="w-3 h-3" />
                {categoryInfo.name}
              </span>
            )}
            {post.tags.slice(0, 1).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs font-medium bg-background/90 backdrop-blur-sm rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground mb-2.5 sm:mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {format(new Date(post.published_at), "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {getReadTime(post.excerpt)} min read
            </span>
          </div>
          <h2 className={cn(
            "font-bold mb-2 group-hover:text-primary transition-colors break-words",
            featured ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
          )}>
            {post.title}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground line-clamp-3 mb-4 break-words">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              By {post.author_name}
            </span>
            <span className="flex items-center gap-1 text-primary font-medium text-xs sm:text-sm group-hover:gap-2 transition-all">
              Read More <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
