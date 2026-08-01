import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  /** Question/answer pairs rendered as FAQPage structured data (great for AI answer engines). */
  faq?: { question: string; answer: string }[];
  /** Any extra JSON-LD graph nodes for this page. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const SITE_URL = "https://www.growhaz.in";

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * AEO/SEO head manager. Sets title, description, canonical, social tags and
 * per-page JSON-LD so answer engines (ChatGPT, Perplexity, Gemini, Copilot)
 * can quote GrowHaz accurately.
 */
export function Seo({ title, description, path = "/", faq, jsonLd }: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path === "/" ? "/" : path}`;
    document.title = title;

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", url);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    const nodes: Record<string, unknown>[] = [];
    if (jsonLd) nodes.push(...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]));
    if (faq?.length) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }

    const scripts: HTMLScriptElement[] = nodes.map((node) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seo = "page";
      script.textContent = JSON.stringify(node);
      document.head.appendChild(script);
      return script;
    });

    return () => {
      scripts.forEach((s) => s.remove());
    };
  }, [title, description, path, faq, jsonLd]);

  return null;
}

export default Seo;
