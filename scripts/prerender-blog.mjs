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
function markdownToHtml(markdown = "") {
  const lines = String(markdown).split("\n");
  const out = [];
  let listOpen = false;
  const inline = (text) =>
    escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
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
function buildHtml(shell, { title, description, canonical, headExtra, bodyHtml, ogType, twitterCard }) {
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
  return html;
}

function writeFile(relPath, contents) {
  const target = resolve(DIST, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function postHtml(shell, post) {
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const description = post.meta_description || post.excerpt || "";
  const articleBody = markdownToHtml(post.content);
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
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>`,
  ]
    .filter(Boolean)
    .join("\n    ");

  const bodyHtml = `
    <article>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog">Blog</a></nav>
      <h1>${escapeHtml(post.title)}</h1>
      <p>By ${escapeHtml(post.author_name || "GrowHaz")} — <time datetime="${escapeAttr(published)}">${escapeHtml(
        new Date(published).toISOString().slice(0, 10),
      )}</time></p>
      ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}
      ${
        post.featured_image
          ? `<img src="${escapeAttr(post.featured_image)}" alt="${escapeAttr(post.title)}" loading="lazy" />`
          : ""
      }
      ${articleBody}
    </article>`;

  return buildHtml(shell, {
    title: `${post.title} | GrowHaz Blog`,
    description,
    canonical,
    headExtra,
    bodyHtml,
    ogType: "article",
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
    bodyHtml: `<main><h1>GrowHaz Blog</h1><ul>${items}</ul></main>`,
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
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    `<script type="application/ld+json">${JSON.stringify(profile)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`,
  ].join("\n    ");
  const bodyHtml = `
    <main class="section-container">
      <article>
        <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/about">About GrowHaz</a> / <span>Founder</span></nav>
        <header>
          <img src="${escapeAttr(FOUNDER_IMAGE)}" alt="Portrait of Om Uikey, Founder and CEO of GrowHaz" width="280" height="280" fetchpriority="high" />
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
