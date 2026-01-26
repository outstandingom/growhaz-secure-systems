import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BlogCategories, BLOG_CATEGORIES } from "@/components/blog/BlogCategories";
import { BlogCard } from "@/components/blog/BlogCard";

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

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image, author_name, tags, category, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (!error && data) {
      setPosts(data as BlogPost[]);
    }
    setLoading(false);
  };

  // Calculate post counts per category
  const postCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(post => {
      const cat = post.category || "general";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [posts]);

  // Filter posts based on search and category
  const filteredPosts = useMemo(() => {
    let filtered = posts;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        post =>
          post.title.toLowerCase().includes(query) ||
          post.excerpt.toLowerCase().includes(query) ||
          post.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [posts, searchQuery, selectedCategory]);

  return (
    <Layout>
      <section className="section-container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-medium uppercase tracking-wider text-primary bg-primary/10 rounded-full border border-primary/20">
              Blog & Insights
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Latest Articles & <span className="text-gradient">Resources</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stay updated with the latest in cybersecurity, AI, web development, SEO strategies, and blockchain technology.
            </p>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <BlogCategories
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              postCounts={postCounts}
            />
          </div>

          {/* Search */}
          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/80 backdrop-blur-sm border-border"
              />
            </div>
          </div>

          {/* Blog Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory !== "all"
                  ? "Try adjusting your search or category filter."
                  : "Check back soon for new content!"}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post, index) => (
                <div
                  key={post.id}
                  className={`animate-fade-in ${index === 0 ? "md:col-span-2 lg:col-span-2" : ""}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <BlogCard post={post} featured={index === 0} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
