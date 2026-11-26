import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, ArrowLeft, Tag, Share2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Seo } from "@/components/Seo";
import { FALLBACK_BLOG_POSTS } from "@/data/blogFallbacks";

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
    // 1. Static-first: check local in-memory fallback posts (100% disconnected from server, instant)
    const fallback = FALLBACK_BLOG_POSTS.find((p) => p.slug === postSlug);
    if (fallback) {
      setPost(fallback as any);
      setLoading(false);

      const related = FALLBACK_BLOG_POSTS
        .filter((p) => p.slug !== postSlug)
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          featured_image: p.featured_image,
          author_name: p.author_name,
          tags: p.tags || [],
          published_at: p.published_at,
        }));
      setRelatedPosts(related);
      return;
    }

    // 2. Otherwise fetch from database if available
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", postSlug)
        .eq("is_published", true)
        .maybeSingle();

      if (!data) {
        navigate("/blog");
        return;
      }

      setPost(data);

      if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
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
    } catch (err) {
      console.error("Error fetching blog post:", err);
      navigate("/blog");
    } finally {
      setLoading(false);
    }
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

  // Helper to extract FAQ schema if present in markdown content
  const extractFaqSchema = (mdContent: string) => {
    const lines = mdContent.split("\n");
    const faqs: { question: string; answer: string }[] = [];
    let currentQuestion = "";
    let currentAnswer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("### ") && line.endsWith("?")) {
        if (currentQuestion && currentAnswer.length > 0) {
          faqs.push({
            question: currentQuestion,
            answer: currentAnswer.join(" ").trim(),
          });
        }
        currentQuestion = line.replace("### ", "").trim();
        currentAnswer = [];
      } else if (currentQuestion) {
        if (line.startsWith("## ")) {
          if (currentAnswer.length > 0) {
            faqs.push({
              question: currentQuestion,
              answer: currentAnswer.join(" ").trim(),
            });
          }
          currentQuestion = "";
          currentAnswer = [];
        } else if (line && !line.startsWith("#")) {
          currentAnswer.push(line);
        }
      }
    }

    if (currentQuestion && currentAnswer.length > 0) {
      faqs.push({
        question: currentQuestion,
        answer: currentAnswer.join(" ").trim(),
      });
    }

    if (faqs.length === 0) return null;

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    };
  };

  const renderInlineStyles = (text: string) => {
    const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
    const parts = text.split(tokenRegex);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-[0.85em] break-all">
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const isInternal = href.startsWith("/");
        return isInternal ? (
          <Link key={i} to={href} className="text-primary hover:underline break-words">
            {label}
          </Link>
        ) : (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words">
            {label}
          </a>
        );
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
        elements.push(<hr key={i} className="my-6 sm:my-8 border-border" />);
        i++;
        continue;
      }

      // Skip single-H1 if it duplicates post title
      if (line.startsWith("# ") && post && line.replace("# ", "").trim().toLowerCase() === post.title.trim().toLowerCase()) {
        i++;
        continue;
      }

      // H2 Headers
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-xl sm:text-2xl font-bold mt-7 sm:mt-8 mb-3 sm:mb-4 text-foreground break-words">
            {line.replace("## ", "")}
          </h2>
        );
        i++;
        continue;
      }

      // H3 Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-lg sm:text-xl font-semibold mt-5 sm:mt-6 mb-2.5 sm:mb-3 text-foreground break-words">
            {line.replace("### ", "")}
          </h3>
        );
        i++;
        continue;
      }

      // Blockquotes
      if (line.startsWith("> ")) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-primary pl-3.5 sm:pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-sm sm:text-base text-foreground break-words">
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
            <div key={`table-${i}`} className="my-6 -mx-2 px-2 sm:mx-0 sm:px-0 overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse border border-border rounded-lg text-xs sm:text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {headerRow.map((cell, cellIdx) => (
                      <th key={cellIdx} className="border border-border px-3 sm:px-4 py-2 text-left font-semibold text-foreground">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-muted/30">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="border border-border px-3 sm:px-4 py-2 text-muted-foreground">
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
          <li key={i} className="ml-5 sm:ml-6 my-1 text-sm sm:text-base text-muted-foreground list-decimal break-words [overflow-wrap:anywhere]">
            {renderInlineStyles(line.replace(/^\d+\.\s/, ""))}
          </li>
        );
        i++;
        continue;
      }

      // Bullet points
      if (line.startsWith("- ")) {
        elements.push(
          <li key={i} className="ml-5 sm:ml-6 my-1 text-sm sm:text-base text-muted-foreground list-disc break-words [overflow-wrap:anywhere]">
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
        <p key={i} className="text-sm sm:text-base text-muted-foreground leading-relaxed my-2 break-words [overflow-wrap:anywhere]">
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
      <Seo
        title={`${post.title} | GrowHaz Blog`}
        description={post.meta_description || post.excerpt || ""}
        path={`/blog/${post.slug}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.meta_description || post.excerpt,
            author: { "@type": "Person", name: post.author_name },
            datePublished: post.published_at,
            image: post.featured_image || undefined,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://www.growhaz.in/blog/${post.slug}`,
            },
            publisher: { "@id": "https://www.growhaz.in/#organization" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://www.growhaz.in/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.growhaz.in/blog" },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: `https://www.growhaz.in/blog/${post.slug}`,
              },
            ],
          },
          ...(extractFaqSchema(post.content) ? [extractFaqSchema(post.content)] : []),
        ]}
      />


      <article className="section-container">
        <div className="max-w-4xl mx-auto min-w-0">
          {/* Back Link */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 sm:mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-6 sm:mb-8">
            {/* Tags */}
            <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
              {(post.tags || []).map(tag => (
                <Link
                  key={tag}
                  to={`/blog?tag=${tag}`}
                  className="px-2.5 sm:px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 leading-tight break-words">
              {post.title}
            </h1>

            <p className="text-base sm:text-xl text-muted-foreground mb-5 sm:mb-6 leading-relaxed break-words">
              {post.excerpt}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pb-5 sm:pb-6 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{post.author_name}</p>
                  <p className="text-xs text-muted-foreground">Author</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(post.published_at), "MMMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {getReadTime(post.content)} min read
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleShare} className="ml-0 sm:ml-auto w-full sm:w-auto">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image && (
            <div className="mb-6 sm:mb-8 rounded-2xl overflow-hidden">
              <img
                src={post.featured_image}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-invert max-w-none break-words [overflow-wrap:anywhere]">
            {renderContent(post.content)}
          </div>

          {/* Share CTA */}
          <div className="mt-10 sm:mt-12 p-5 sm:p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border text-center">
            <h3 className="text-base sm:text-lg font-semibold mb-2">Found this article helpful?</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">Share it with your network!</p>
            <Button variant="hero" onClick={handleShare} className="w-full sm:w-auto">
              <Share2 className="w-4 h-4 mr-2" />
              Share Article
            </Button>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mt-12 sm:mt-16">
              <h2 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6">Related Articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {relatedPosts.map(related => (
                  <Link
                    key={related.id}
                    to={`/blog/${related.slug}`}
                    className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border p-4 card-hover min-w-0"
                  >
                    <div className="flex gap-2 mb-2">
                      {(related.tags || []).slice(0, 1).map(tag => (
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
