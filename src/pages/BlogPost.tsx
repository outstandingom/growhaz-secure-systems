import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, ArrowLeft, Tag, Share2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  author_name: string;
  tags: string[];
  meta_description: string | null;
  published_at: string;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  author_name: string;
  tags: string[];
  published_at: string;
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (slug) {
      fetchPost(slug);
    }
  }, [slug]);

  const fetchPost = async (postSlug: string) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", postSlug)
      .eq("is_published", true)
      .maybeSingle();

    if (error || !data) {
      navigate("/blog");
      return;
    }

    setPost(data);
    
    // Fetch related posts based on tags
    if (data.tags.length > 0) {
      const { data: related } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image, author_name, tags, published_at")
        .eq("is_published", true)
        .neq("id", data.id)
        .overlaps("tags", data.tags)
        .limit(3);

      if (related) {
        setRelatedPosts(related);
      }
    }

    setLoading(false);
  };

  const getReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const wordCount = content.split(" ").length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Article link has been copied to clipboard.",
      });
    }
  };

  const renderInlineStyles = (text: string) => {
    // Handle inline bold and other formatting
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: JSX.Element[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Horizontal rule
      if (line.trim() === "---") {
        elements.push(<hr key={i} className="my-8 border-border" />);
        i++;
        continue;
      }

      // H2 Headers
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-2xl font-bold mt-8 mb-4 text-foreground">
            {line.replace("## ", "")}
          </h2>
        );
        i++;
        continue;
      }

      // H3 Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-xl font-semibold mt-6 mb-3 text-foreground">
            {line.replace("### ", "")}
          </h3>
        );
        i++;
        continue;
      }

      // Blockquotes
      if (line.startsWith("> ")) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-foreground">
            {renderInlineStyles(line.replace("> ", ""))}
          </blockquote>
        );
        i++;
        continue;
      }

      // Table detection - look for lines with | characters
      if (line.includes("|") && line.trim().startsWith("|")) {
        const tableRows: string[] = [];
        while (i < lines.length && lines[i].includes("|")) {
          tableRows.push(lines[i]);
          i++;
        }

        // Parse table
        const parsedRows = tableRows
          .filter(row => !row.match(/^\|[\s-:|]+\|$/)) // Filter out separator rows
          .map(row => 
            row.split("|")
              .filter(cell => cell.trim() !== "")
              .map(cell => cell.trim())
          );

        if (parsedRows.length > 0) {
          const headerRow = parsedRows[0];
          const bodyRows = parsedRows.slice(1);

          elements.push(
            <div key={`table-${i}`} className="my-6 overflow-x-auto">
              <table className="w-full border-collapse border border-border rounded-lg">
                <thead>
                  <tr className="bg-muted/50">
                    {headerRow.map((cell, cellIdx) => (
                      <th key={cellIdx} className="border border-border px-4 py-2 text-left font-semibold text-foreground">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-muted/30">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="border border-border px-4 py-2 text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // Numbered lists (1. 2. 3.)
      if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={i} className="ml-6 my-1 text-muted-foreground list-decimal">
            {renderInlineStyles(line.replace(/^\d+\.\s/, ""))}
          </li>
        );
        i++;
        continue;
      }

      // Bullet points
      if (line.startsWith("- ")) {
        elements.push(
          <li key={i} className="ml-6 my-1 text-muted-foreground list-disc">
            {renderInlineStyles(line.replace("- ", ""))}
          </li>
        );
        i++;
        continue;
      }

      // Empty lines
      if (line.trim() === "") {
        elements.push(<br key={i} />);
        i++;
        continue;
      }

      // Regular paragraph with inline styles
      elements.push(
        <p key={i} className="text-muted-foreground leading-relaxed my-2">
          {renderInlineStyles(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  if (loading) {
    return (
      <Layout>
        <div className="section-container flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="section-container text-center py-20">
          <h1 className="text-2xl font-bold mb-4">Article not found</h1>
          <Button variant="hero" onClick={() => navigate("/blog")}>
            Back to Blog
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* JSON-LD Schema for SEO */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.meta_description || post.excerpt,
          author: {
            "@type": "Person",
            name: post.author_name,
          },
          datePublished: post.published_at,
          publisher: {
            "@type": "Organization",
            name: "GROWHAZ",
          },
        })}
      </script>

      <article className="section-container">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-8">
            {/* Tags */}
            <div className="flex gap-2 flex-wrap mb-4">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/blog?tag=${tag}`}
                  className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              {post.title}
            </h1>

            <p className="text-xl text-muted-foreground mb-6">
              {post.excerpt}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-6 pb-6 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{post.author_name}</p>
                  <p className="text-xs text-muted-foreground">Author</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(post.published_at), "MMMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {getReadTime(post.content)} min read
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleShare} className="ml-auto">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image && (
            <div className="mb-8 rounded-2xl overflow-hidden">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            {renderContent(post.content)}
          </div>

          {/* Share CTA */}
          <div className="mt-12 p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border text-center">
            <h3 className="text-lg font-semibold mb-2">Found this article helpful?</h3>
            <p className="text-muted-foreground mb-4">Share it with your network!</p>
            <Button variant="hero" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Article
            </Button>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map(related => (
                  <Link
                    key={related.id}
                    to={`/blog/${related.slug}`}
                    className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border p-4 card-hover"
                  >
                    <div className="flex gap-2 mb-2">
                      {related.tags.slice(0, 1).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {related.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </Layout>
  );
}
