/**
 * Post-build prerenderer for the blog.
 *
 * Blog posts live in Supabase and are fetched client-side, so crawlers that do
 * not execute JS (and most AI answer-engine crawlers) see an empty page.
 * This script runs after `vite build`, pulls every published post from the
 * Supabase REST API, and writes a real static HTML file per post into `dist/`
 * with the full article text, head metadata and Article JSON-LD.
 *
 * The Vite bundle is still loaded, so the React app hydrates as usual for
 * humans — the static markup only exists for crawlers and first paint.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const SITE_URL = "https://www.growhaz.in";
const FOUNDER_PATH = "/founder/om-uikey";
const FOUNDER_IMAGE = "/__l5e/assets-v1/f5f26144-8598-4fb6-8c6a-6ecd385c054b/om-uikey-founder.png";
const FOUNDER_TITLE = "Om Uikey, Founder of GrowHaz | Cybersecurity, Blockchain & AI";
const FOUNDER_DESCRIPTION =
  "Om Uikey is the founder and CEO of GrowHaz, building blockchain document verification, cybersecurity and adaptive-firewall research, and useful AI automation for real-world problems.";
const SUPABASE_URL = "https://hkigsjwppfbtkuqhaxsp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraWdzandwcGZidGt1cWhheHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODY2MjEsImV4cCI6MjA4NDc2MjYyMX0.wNueoaWZWlJY5TnQiZQKEfKwaSPhyt69X3M80ezO-Gc";

const DIST = resolve("dist");

const STATIC_ROUTES = [
  { path: "/", priority: "1.0" },
  { path: "/security-tools", priority: "0.8" },
  { path: "/development", priority: "0.8" },
  { path: "/seo", priority: "0.8" },
  { path: "/automation", priority: "0.8" },
  { path: "/marketing", priority: "0.8" },
  { path: "/projects", priority: "0.8" },
  { path: "/pricing", priority: "0.8" },
  { path: "/blockchain", priority: "0.8" },
  { path: "/verify-document", priority: "0.8" },
  { path: "/about", priority: "0.7" },
  { path: FOUNDER_PATH, priority: "0.7" },
  { path: "/contact", priority: "0.7" },
  { path: "/blog", priority: "0.9" },
  { path: "/mentorship", priority: "0.8" },
  { path: "/terms", priority: "0.3" },
  { path: "/privacy-policy", priority: "0.3" },
];

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeAttr = (value = "") => escapeHtml(value).replace(/'/g, "&#39;");

/** Minimal markdown -> HTML for the crawler-visible snapshot. */
function markdownToHtml(markdown = "", postTitle = "") {
  const lines = String(markdown).split("\n");
  const out = [];
  let listType = null;
  const normalizedTitle = String(postTitle || "").trim().toLowerCase();

  const inline = (text) =>
    escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const closeList = () => {
    if (listType === "ul") out.push("</ul>");
    if (listType === "ol") out.push("</ol>");
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line === "---") {
      closeList();
      out.push("<hr />");
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const text = heading[2].trim();
      if (heading[1].length === 1 && normalizedTitle && text.toLowerCase() === normalizedTitle) {
        continue;
      }
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      continue;
    }
    if (line.startsWith("> ")) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    if (line.startsWith("|") && line.includes("|")) {
      closeList();
      const rawTable = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rawTable.push(lines[i].trim());
        i++;
      }
      i--;
      const parsed = rawTable
        .filter((r) => !/^\|[\s-:|]+\|$/.test(r))
        .map((r) =>
          r
            .split("|")
            .filter((cell) => cell.trim() !== "")
            .map((cell) => cell.trim()),
        );
      if (parsed.length > 0) {
        const header = parsed[0];
        const body = parsed.slice(1);
        out.push(
          `<div class="table-wrap"><table><thead><tr>${header
            .map((c) => `<th>${inline(c)}</th>`)
            .join("")}</tr></thead><tbody>${body
            .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`,
        );
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

async function fetchPublishedPosts() {
  const url =
    `${SUPABASE_URL}/rest/v1/blog_posts` +
    `?select=id,title,slug,excerpt,content,featured_image,author_name,tags,category,meta_description,published_at,updated_at` +
    `&is_published=eq.true&order=published_at.desc`;

  const response = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/** Replace/insert head tags in the built index.html shell. */
function buildHtml(shell, { title, description, canonical, headExtra, bodyHtml, ogType, twitterCard, isStatic = false }) {
  let html = shell;

  if (ogType) {
    html = html.replace(
      /<meta property="og:type"[^>]*>/,
      `<meta property="og:type" content="${escapeAttr(ogType)}" />`,
    );
  }
  if (twitterCard) {
    html = html.replace(
      /<meta name="twitter:card"[^>]*>/,
      `<meta name="twitter:card" content="${escapeAttr(twitterCard)}" />`,
    );
  }

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  );
  html = html.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
  );
  html = html.replace(
    /<meta property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
  );
  html = html.replace(
    /<meta property="og:url"[^>]*>/,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  );

  if (headExtra) html = html.replace("</head>", `${headExtra}\n</head>`);
  if (bodyHtml) {
    html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  }
  if (isStatic) {
    // Make blog article completely static and disconnected from server / SPA bundle crashes
    html = html.replace(/<script type="module" crossorigin src="\/assets\/[^"]+"><\/script>/g, "");
    html = html.replace(/<link rel="modulepreload" crossorigin href="\/assets\/[^"]+">/g, "");
  }
  return html;
}

function writeFile(relPath, contents) {
  const target = resolve(DIST, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function extractFaqSchema(content = "") {
  const lines = String(content).split("\n");
  const faqs = [];
  let currentQuestion = "";
  let currentAnswer = [];

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
}

function postHtml(shell, post) {
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const description = post.meta_description || post.excerpt || "";
  const articleBody = markdownToHtml(post.content, post.title);
  const published = post.published_at;
  const modified = post.updated_at || post.published_at;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    articleSection: post.category || undefined,
    keywords: Array.isArray(post.tags) && post.tags.length ? post.tags.join(", ") : undefined,
    datePublished: published,
    dateModified: modified,
    image: post.featured_image || undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Person", name: post.author_name || "GrowHaz" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  };

  const headExtra = [
    `<meta property="article:published_time" content="${escapeAttr(published)}" />`,
    `<meta property="article:modified_time" content="${escapeAttr(modified)}" />`,
    post.featured_image
      ? `<meta property="og:image" content="${escapeAttr(post.featured_image)}" />`
      : "",
    `<style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        max-width: 100%;
        overflow-x: hidden;
        -webkit-text-size-adjust: 100%;
        background-color: #09090b;
        color: #f4f4f5;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      a { color: #38bdf8; text-decoration: none; overflow-wrap: anywhere; }
      a:hover { text-decoration: underline; }
      img { max-width: 100%; height: auto; display: block; }
      header a { color: #fafafa; text-decoration: none; }
      .site-header {
        border-bottom: 1px solid #27272a;
        padding: 0.9rem 1rem;
        max-width: 1100px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        position: relative;
      }
      .site-logo { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.025em; color: #fff; text-decoration: none; flex-shrink: 0; }
      .site-nav { display: flex; flex-wrap: wrap; gap: 1.25rem; font-size: 0.875rem; }
      .site-nav a { color: #a1a1aa; text-decoration: none; transition: color 0.2s; }
      .site-nav a:hover { color: #fff; }
      .mobile-nav { display: none; }
      .mobile-nav summary {
        list-style: none;
        cursor: pointer;
        padding: 0.5rem 0.85rem;
        border-radius: 0.5rem;
        border: 1px solid #27272a;
        background: #18181b;
        color: #fafafa;
        font-size: 0.875rem;
        font-weight: 600;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .mobile-nav summary::-webkit-details-marker { display: none; }
      .mobile-nav-panel {
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        background: #111114;
        border-bottom: 1px solid #27272a;
        padding: 0.5rem 1rem 0.9rem;
        display: flex;
        flex-direction: column;
        z-index: 50;
      }
      .mobile-nav-panel a {
        color: #e4e4e7;
        min-height: 44px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid #1f1f23;
        font-size: 0.95rem;
        font-weight: 500;
      }
      .mobile-nav-panel a:last-child { border-bottom: none; }
      .article-container { width: 100%; max-width: 820px; margin: 0 auto; padding: 2rem 1.25rem; }
      .breadcrumb { font-size: 0.825rem; color: #a1a1aa; margin-bottom: 1.25rem; line-height: 1.6; overflow-wrap: anywhere; }
      .article-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; font-size: 0.85rem; color: #a1a1aa; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #27272a; }
      .article-excerpt { font-size: 1.075rem; color: #a1a1aa; line-height: 1.75; margin-bottom: 1.75rem; font-weight: 500; overflow-wrap: anywhere; }
      h1 { font-size: clamp(1.55rem, 5vw, 2.35rem); line-height: 1.22; font-weight: 800; color: #ffffff; margin: 0 0 0.9rem; overflow-wrap: anywhere; word-break: break-word; }
      h2 { font-size: clamp(1.2rem, 3.6vw, 1.55rem); line-height: 1.3; font-weight: 700; color: #ffffff; margin-top: 2rem; margin-bottom: 0.8rem; border-bottom: 1px solid #27272a; padding-bottom: 0.45rem; overflow-wrap: anywhere; }
      h3 { font-size: clamp(1.05rem, 3vw, 1.25rem); line-height: 1.35; font-weight: 600; color: #38bdf8; margin-top: 1.4rem; margin-bottom: 0.5rem; overflow-wrap: anywhere; }
      p, li, blockquote { line-height: 1.75; margin-bottom: 1rem; color: #d4d4d8; font-size: 1rem; overflow-wrap: anywhere; word-break: break-word; }
      ul, ol { padding-left: 1.35rem; margin-bottom: 1.15rem; }
      li { margin-bottom: 0.45rem; }
      blockquote { border-left: 3px solid #38bdf8; margin: 1.25rem 0; padding: 0.6rem 1rem; background: rgba(56, 189, 248, 0.06); border-radius: 0 0.5rem 0.5rem 0; }
      hr { border: none; border-top: 1px solid #27272a; margin: 1.75rem 0; }
      strong { color: #ffffff; font-weight: 600; }
      code { background: #18181b; border: 1px solid #27272a; padding: 0.12rem 0.35rem; border-radius: 4px; font-family: monospace; font-size: 0.86em; color: #38bdf8; overflow-wrap: anywhere; }
      .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 1.25rem 0; border: 1px solid #27272a; border-radius: 0.5rem; }
      table { width: 100%; border-collapse: collapse; min-width: 480px; font-size: 0.9rem; }
      th, td { border-bottom: 1px solid #27272a; padding: 0.65rem 0.85rem; text-align: left; color: #d4d4d8; }
      th { background: #18181b; color: #fafafa; font-weight: 600; }
      .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
      .cta-card { margin-top: 2.5rem; padding: 1.5rem 1.25rem; border-radius: 1rem; background: #18181b; border: 1px solid #27272a; text-align: center; }
      .cta-card h3 { font-size: clamp(1.15rem, 4vw, 1.45rem); color: #fff; margin: 0 0 0.5rem; }
      .cta-card p { color: #a1a1aa; margin: 0 0 1rem; font-size: 0.95rem; }
      .cta-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.75rem 1.4rem; min-height: 44px; border-radius: 0.75rem; background: #38bdf8; color: #09090b; font-weight: 700; text-decoration: none; margin-top: 0.5rem; }
      .cta-btn:hover { background: #7dd3fc; text-decoration: none; }
      .article-footer-nav { margin-top: 2.25rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem 1rem; font-size: 0.9rem; }
      footer { margin-top: 3.5rem; border-top: 1px solid #27272a; padding: 2rem 1rem; text-align: center; color: #71717a; font-size: 0.85rem; }
      @media (max-width: 767px) {
        .site-nav { display: none; }
        .mobile-nav { display: block; }
        .article-container { padding: 1.25rem 1rem 2rem; }
        p, li { font-size: 0.96rem; line-height: 1.7; }
        .cta-btn { width: 100%; }
      }
    </style>`,

    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>`,
    (() => {
      const faq = extractFaqSchema(post.content);
      return faq ? `<script type="application/ld+json">${JSON.stringify(faq)}</script>` : "";
    })(),
  ]
    .filter(Boolean)
    .join("\n    ");

  const bodyHtml = `
    <header class="site-header">
      <a href="/" class="site-logo">GROWHAZ</a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/security-tools">Security Tools</a>
        <a href="/automation">Automation</a>
        <a href="/blockchain">Blockchain</a>
        <a href="/blog">Blog</a>
        <a href="/contact">Contact</a>
      </nav>
      <details class="mobile-nav">
        <summary aria-label="Toggle navigation menu">☰ Menu</summary>
        <nav class="mobile-nav-panel" aria-label="Mobile navigation">
          <a href="/security-tools">Security Tools</a>
          <a href="/automation">Automation</a>
          <a href="/blockchain">Blockchain</a>
          <a href="/blog">Blog</a>
          <a href="/contact">Contact</a>
        </nav>
      </details>
    </header>
    <main class="article-container">
      <article>
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Home</a> / <a href="/blog">Blog</a> / <span style="color: #fafafa;">${escapeHtml(post.title)}</span>
        </nav>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta">
          <span>By <strong style="color: #fff;">${escapeHtml(post.author_name || "GrowHaz")}</strong></span>
          <span>•</span>
          <time datetime="${escapeAttr(published)}">${escapeHtml(new Date(published).toISOString().slice(0, 10))}</time>
          ${post.category ? `<span>•</span><span class="badge">${escapeHtml(post.category)}</span>` : ""}
        </div>
        ${post.excerpt ? `<p class="article-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
        ${
          post.featured_image
            ? `<div style="margin-bottom: 1.75rem; border-radius: 1rem; overflow: hidden; border: 1px solid #27272a;"><img src="${escapeAttr(post.featured_image)}" alt="${escapeAttr(post.title)}" loading="lazy" /></div>`
            : ""
        }
        <div class="article-body">
          ${articleBody}
        </div>
        <div class="cta-card">
          <h3>Ready to Automate Your Business?</h3>
          <p>Let GROWHAZ assess and build practical AI &amp; workflow automations tailored to your business operations.</p>
          <a href="/contact" class="cta-btn">Discuss Your Automation Needs</a>
        </div>
      </article>
      <div class="article-footer-nav">
        <a href="/blog">← Back to all articles</a>
        <a href="/automation">Explore Automation Tools →</a>
      </div>
    </main>
    <footer>
      <p>© 2026 GrowHaz. All rights reserved.</p>
    </footer>`;

  return buildHtml(shell, {
    title: `${post.title} | GrowHaz Blog`,
    description,
    canonical,
    headExtra,
    bodyHtml,
    ogType: "article",
    isStatic: true,
  });
}

function blogIndexHtml(shell, posts) {
  const items = posts
    .map(
      (post) => `
      <li>
        <a href="/blog/${escapeAttr(post.slug)}"><h2>${escapeHtml(post.title)}</h2></a>
        <p>${escapeHtml(post.excerpt || "")}</p>
      </li>`,
    )
    .join("");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog`,
    name: "GrowHaz Blog",
    publisher: { "@id": `${SITE_URL}/#organization` },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.published_at,
    })),
  };

  return buildHtml(shell, {
    title: "GrowHaz Blog — Cybersecurity, Blockchain & SEO Insights",
    description:
      "Guides and insights on website security, blockchain document verification, digital forensics and SEO from the GrowHaz team.",
    canonical: `${SITE_URL}/blog`,
    headExtra: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    bodyHtml: `<main style="max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem;"><h1>GrowHaz Blog</h1><ul>${items}</ul></main>`,
  });
}

function founderPageHtml(shell) {
  const canonical = `${SITE_URL}${FOUNDER_PATH}`;
  const image = `${SITE_URL}${FOUNDER_IMAGE}`;
  const person = {
    "@type": "Person",
    "@id": `${canonical}#person`,
    name: "Om Uikey",
    url: canonical,
    image,
    jobTitle: "Founder & CEO",
    description: FOUNDER_DESCRIPTION,
    worksFor: { "@id": `${SITE_URL}/#organization`, name: "GrowHaz" },
    founderOf: { "@id": `${SITE_URL}/#organization`, name: "GrowHaz" },
    knowsAbout: [
      "Blockchain document verification and provenance",
      "Cybersecurity",
      "Adaptive firewall research",
      "AI and workflow automation",
      "Software engineering",
    ],
  };
  const profile = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": canonical,
    url: canonical,
    name: FOUNDER_TITLE,
    mainEntity: person,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "About GrowHaz", item: `${SITE_URL}/about` },
      { "@type": "ListItem", position: 3, name: "Om Uikey", item: canonical },
    ],
  };
  const headExtra = [
    `<script type="application/ld+json">${JSON.stringify(profile)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`,
  ].join("\n    ");
  const bodyHtml = `
    <main class="section-container">
      <article>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/about">About GrowHaz</a> / <span>Founder</span></nav>
        <header>
          <img src="${escapeAttr(FOUNDER_IMAGE)}" alt="Portrait of Om Uikey, Founder and CEO of GrowHaz" width="280" fetchpriority="high" />
          <p>Founder &amp; CEO of GrowHaz</p>
          <h1>Om Uikey</h1>
          <p>Software developer, cybersecurity researcher and AI builder focused on practical technology.</p>
          <p>Om Uikey is the founder and CEO of GrowHaz. He builds practical technology to solve real-world problems, including blockchain document verification and provenance, cybersecurity research into adaptive firewalls, and AI automation where it is useful.</p>
        </header>
        <section aria-labelledby="founder-work">
          <h2 id="founder-work">What Om Uikey works on</h2>
          <ul>
            <li><strong>Blockchain document verification:</strong> document integrity, provenance and traceable process records.</li>
            <li><strong>Cybersecurity:</strong> website security assessment, evidence-based findings and research into adaptive firewall systems.</li>
            <li><strong>AI and automation:</strong> applying AI and workflow automation where they solve a practical problem.</li>
          </ul>
          <p>At GrowHaz, Om works across software engineering, cybersecurity, blockchain and automation to build useful systems for businesses and people.</p>
          <ul>
            <li><a href="/blockchain">Blockchain document verification</a></li>
            <li><a href="/security-tools">Cybersecurity tools</a></li>
            <li><a href="/automation">Automation tools</a></li>
            <li><a href="/about">About GrowHaz</a></li>
          </ul>
        </section>
      </article>
    </main>`;

  return buildHtml(shell, {
    title: FOUNDER_TITLE,
    description: FOUNDER_DESCRIPTION,
    canonical,
    headExtra,
    bodyHtml,
    twitterCard: "summary_large_image",
  });
}

function sitemapXml(posts) {
  const entry = ({ loc, lastmod, priority }) =>
    [
      "<url>",
      `  <loc>${loc}</loc>`,
      lastmod ? `  <lastmod>${lastmod}</lastmod>` : null,
      `  <priority>${priority}</priority>`,
      "</url>",
    ]
      .filter(Boolean)
      .join("\n");

  const urls = [
    ...STATIC_ROUTES.map((route) =>
      entry({ loc: `${SITE_URL}${route.path === "/" ? "/" : route.path}`, priority: route.priority }),
    ),
    ...posts.map((post) =>
      entry({
        loc: `${SITE_URL}/blog/${post.slug}`,
        lastmod: new Date(post.updated_at || post.published_at).toISOString(),
        priority: "0.7",
      }),
    ),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

async function main() {
  const shellPath = resolve(DIST, "index.html");
  if (!existsSync(shellPath)) {
    console.warn("prerender-blog: dist/index.html not found — skipping.");
    return;
  }
  const shell = readFileSync(shellPath, "utf8");

  let posts = [];
  try {
    posts = await fetchPublishedPosts();
  } catch (error) {
    console.warn(`prerender-blog: could not fetch posts (${error.message}) — skipping post pages.`);
  }

  // Load local codebase markdown posts so they are always prerendered
  const localPosts = [];
  const betulMdPath = resolve("src/content/ai-automation-services-in-betul.md");
  if (existsSync(betulMdPath)) {
    localPosts.push({
      id: "ai-automation-services-in-betul",
      slug: "ai-automation-services-in-betul",
      title: "AI Automation Services in Betul: Automate Your Business with GROWHAZ",
      excerpt:
        "Practical ways Betul businesses can connect AI and automation to WhatsApp, Instagram, hotel enquiries, inventory, CRM and the software they already use.",
      meta_description:
        "Looking for AI automation services in Betul? GROWHAZ helps businesses assess practical ways to automate Instagram, WhatsApp, customer support, hotel enquiries, inventory, sales and repetitive tasks using existing software where feasible.",
      content: readFileSync(betulMdPath, "utf8"),
      author_name: "GROWHAZ",
      published_at: "2026-11-16T00:00:00Z",
      updated_at: "2026-11-16T00:00:00Z",
      category: "ai-agents",
      tags: [
        "AI Automation",
        "Betul",
        "Business Automation",
        "WhatsApp Automation",
        "Instagram Automation",
        "Software Integration",
      ],
      featured_image: null,
    });
  }

  for (const lp of localPosts) {
    if (!posts.some((p) => p.slug === lp.slug)) {
      posts.unshift(lp);
    }
  }

  for (const post of posts) {
    if (!post.slug) continue;
    const html = postHtml(shell, post);
    // Both shapes so any host resolves /blog/<slug> to a static file.
    writeFile(`blog/${post.slug}/index.html`, html);
    writeFile(`blog/${post.slug}.html`, html);
  }
  writeFile("founder/om-uikey/index.html", founderPageHtml(shell));
  writeFile("blog/index.html", blogIndexHtml(shell, posts));
  writeFile("sitemap.xml", sitemapXml(posts));

  console.log(`prerender-blog: wrote founder profile, ${posts.length} post pages + blog index + sitemap.xml`);
}

main().catch((error) => {
  console.error("prerender-blog failed:", error);
});
