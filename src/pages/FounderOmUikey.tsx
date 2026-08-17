import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  Shield,
  Blocks,
  Workflow,
  Zap,
  Lightbulb,
  Code2,
  Github,
  Linkedin,
  Youtube,
  Instagram,
  Twitter,
  Globe,
} from "lucide-react";

/**
 * Centralized social configuration.
 * Leave a URL empty ("") to hide that link. Do not add unverified profiles.
 */
const SOCIAL_LINKS: { key: string; label: string; url: string; icon: typeof Github }[] = [
  { key: "github", label: "GitHub", url: "", icon: Github },
  { key: "linkedin", label: "LinkedIn", url: "", icon: Linkedin },
  { key: "youtube", label: "YouTube", url: "", icon: Youtube },
  { key: "instagram", label: "Instagram", url: "", icon: Instagram },
  { key: "x", label: "X", url: "", icon: Twitter },
  { key: "huggingface", label: "Hugging Face", url: "", icon: Globe },
];

const activeSocials = SOCIAL_LINKS.filter((s) => s.url.trim().length > 0);

const coreSkills = [
  {
    icon: Lightbulb,
    title: "Problem Solving",
    text: "Breaking complex technical problems into practical, testable systems.",
  },
  {
    icon: Shield,
    title: "Cybersecurity",
    text: "Web security, vulnerability assessment, security testing and security automation.",
  },
  {
    icon: Brain,
    title: "Artificial Intelligence",
    text: "LLM applications, RAG, AI agents, computer vision and AI-powered systems.",
  },
  {
    icon: Blocks,
    title: "Blockchain",
    text: "Smart contracts, Web3 and blockchain-based integrity systems.",
  },
  {
    icon: Zap,
    title: "Automation",
    text: "API integrations, AI workflows and automated processes.",
  },
  {
    icon: Workflow,
    title: "Workflow Engineering",
    text: "Designing systems that connect applications, APIs, databases, AI and automated processes.",
  },
];

const whatIBuild = [
  { title: "Cybersecurity Tools", text: "Scanners and testing tools that find real issues and report them with evidence." },
  { title: "AI Applications", text: "LLM-based assistants, RAG pipelines and AI agents applied to specific workflows." },
  { title: "Automation Systems", text: "API integrations and automated processes that remove repetitive manual work." },
  { title: "Software Products", text: "Web platforms and internal systems built end to end, from database to interface." },
  { title: "Blockchain Systems", text: "Smart contracts and on-chain records used for document integrity and process trails." },
  { title: "Developer / Research Tools", text: "Utilities and prototypes used to test ideas, measure results and support research." },
];

const featuredWork = [
  {
    title: "GrowHaz Security Systems",
    text: "A security assessment and scanning platform focused on website security analysis, vulnerability detection, security configuration analysis and structured security reporting.",
    tags: ["Cybersecurity", "Web Security", "Automation"],
    to: "/security-tools",
    experimental: false,
  },
  {
    title: "Document Verification & Forensic Technology",
    text: "Research and development involving document integrity, content hashing, manipulation detection, image forensics and evidence-chain concepts.",
    tags: ["AI", "Digital Forensics", "Blockchain", "Computer Vision"],
    to: "/blockchain",
    experimental: false,
  },
  {
    title: "Smart Krishi Advisor",
    text: "An experimental AI-powered agricultural technology concept involving soil information, land mapping, AI recommendations, weather information, market information and government scheme discovery.",
    tags: ["AI", "Agriculture", "RAG", "Automation"],
    to: "/projects",
    experimental: true,
  },
  {
    title: "Neo / SuperDNA",
    text: "Experimental AI architecture research involving memory systems, knowledge representation, world models and AI-agent concepts.",
    tags: ["AI", "Knowledge Graphs", "AI Agents"],
    to: "/projects",
    experimental: true,
  },
];

const techStack = [
  { group: "Frontend", items: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Tailwind", "Bootstrap"] },
  { group: "Backend", items: ["Node.js", "Express.js", "Python"] },
  { group: "Databases", items: ["PostgreSQL", "Supabase", "Firebase", "MongoDB", "MySQL"] },
  { group: "AI", items: ["LLMs", "RAG", "Computer Vision", "OpenCV", "YOLO", "MediaPipe", "Knowledge Graphs"] },
  { group: "Blockchain", items: ["Solidity", "Hardhat", "Ethers.js", "Wagmi", "IPFS"] },
  { group: "Automation / DevOps", items: ["GitHub", "GitHub Actions", "n8n", "Vercel", "Netlify", "AWS/Lambda concepts"] },
];

const interests = [
  "Artificial Intelligence",
  "Cybersecurity",
  "Computer Vision",
  "Blockchain",
  "Knowledge Graphs",
  "AI Agents",
  "Automation",
  "Digital Forensics",
  "Workflow Systems",
];

const faq = [
  {
    question: "Who is Om Uikey?",
    answer:
      "Om Uikey is a software developer and entrepreneur, and the Founder & CEO of GrowHaz. He works on software products and technology systems across AI, cybersecurity, blockchain and automation.",
  },
  {
    question: "Who is the founder of GrowHaz?",
    answer: "GrowHaz was founded by Om Uikey, who serves as its Founder & CEO.",
  },
  {
    question: "What does Om Uikey do?",
    answer:
      "He builds software products and technology systems: security testing tools, AI applications, automation workflows and blockchain-based document integrity systems.",
  },
  {
    question: "What are Om Uikey's core skills?",
    answer:
      "Problem solving, cybersecurity, artificial intelligence, blockchain, automation and workflow engineering, alongside general software engineering.",
  },
  {
    question: "What cybersecurity work does Om Uikey do?",
    answer:
      "Web security testing, vulnerability assessment, security configuration analysis and security automation, including the scanning and reporting tools built at GrowHaz.",
  },
  {
    question: "What AI technologies does Om Uikey work with?",
    answer:
      "LLM applications, retrieval-augmented generation (RAG), AI agents, computer vision and knowledge graph based systems.",
  },
  {
    question: "Does Om Uikey work with blockchain?",
    answer:
      "Yes. He works with Solidity smart contracts, Ethers.js, IPFS and on-chain records used for document verification and process timelines.",
  },
  {
    question: "What projects has Om Uikey built?",
    answer:
      "GrowHaz Security Systems, document verification and forensic technology, and experimental research projects such as Smart Krishi Advisor and Neo / SuperDNA.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    name: "Om Uikey",
    jobTitle: "Founder & CEO",
    worksFor: {
      "@type": "Organization",
      name: "GrowHaz",
      url: "https://www.growhaz.in/",
    },
    url: "https://www.growhaz.in/founder/om-uikey",
    knowsAbout: [
      "Problem Solving",
      "Cybersecurity",
      "Artificial Intelligence",
      "Blockchain",
      "Automation",
      "Workflow Engineering",
      "Software Engineering",
    ],
    ...(activeSocials.length ? { sameAs: activeSocials.map((s) => s.url) } : {}),
  },
};

function FounderPhoto({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative aspect-square w-full max-w-[280px] rounded-2xl border border-border bg-card overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-6xl font-bold gradient-text tracking-tight">OU</span>
      </div>
    </div>
  );
}

export default function FounderOmUikey() {
  return (
    <Layout>
      <Seo
        title="Om Uikey — Founder & CEO of GrowHaz | AI & Cybersecurity"
        description="Meet Om Uikey, Founder & CEO of GrowHaz. Explore his work across software development, artificial intelligence, cybersecurity, blockchain, automation and technology research."
        path="/founder/om-uikey"
        faq={faq}
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="section-container">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-[280px_1fr] md:items-center">
          <FounderPhoto className="mx-auto md:mx-0" />
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">Om Uikey</h1>
            <p className="text-lg text-primary font-medium mb-2">Founder &amp; CEO of GrowHaz</p>
            <p className="text-sm text-muted-foreground mb-5">
              Software Developer • AI Builder • Cybersecurity Researcher • Entrepreneur
            </p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Om Uikey is the Founder &amp; CEO of GrowHaz, focused on building practical technology products across
              artificial intelligence, cybersecurity, software engineering, blockchain, automation and workflow systems.
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <a href="#featured-work">
                <Button variant="hero" size="lg">
                  Explore My Work
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" size="lg">
                  GrowHaz
                </Button>
              </Link>
              {activeSocials
                .filter((s) => s.key === "github" || s.key === "linkedin")
                .map((s) => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="lg" className="gap-2">
                      <s.icon className="w-4 h-4" />
                      {s.label}
                    </Button>
                  </a>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto p-6 md:p-8 rounded-2xl bg-card border border-border">
          <h2 className="text-2xl font-bold mb-4">About Om Uikey</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Om Uikey is a software developer and entrepreneur. He is the Founder &amp; CEO of GrowHaz, where he works
              on software products and technology systems for businesses and independent teams.
            </p>
            <p>
              His main areas of work are artificial intelligence, cybersecurity, blockchain, automation and software
              engineering. Day to day this means writing application code, building security testing tooling, designing
              data and workflow models, and integrating AI into systems where it produces a measurable result.
            </p>
            <p>
              He is interested in practical technology research — testing ideas as working prototypes, keeping
              experimental work clearly separated from production systems, and turning research into real-world tools.
            </p>
          </div>
        </div>
      </section>

      {/* Core skills */}
      <section className="section-container pt-0">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          Core <span className="gradient-text">Skills</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {coreSkills.map((s) => (
            <div key={s.title} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border text-center">
              <s.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-semibold">{s.title}</span>
              <span className="text-sm text-muted-foreground">{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* What I build */}
      <section className="section-container pt-0">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          What I <span className="gradient-text">Build</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {whatIBuild.map((b) => (
            <div key={b.title} className="flex flex-col gap-2 p-4 rounded-xl bg-card/50 border border-border">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm font-semibold">{b.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">{b.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured work */}
      <section id="featured-work" className="section-container pt-0 scroll-mt-24">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          Featured <span className="gradient-text">Work</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {featuredWork.map((p) => (
            <article key={p.title} className="flex flex-col gap-3 p-6 rounded-2xl bg-card border border-border">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{p.title}</h3>
                {p.experimental && (
                  <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Experimental Research
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              <div className="flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <Link to={p.to} className="text-sm text-primary font-medium inline-flex items-center gap-1 mt-auto">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Technical skills */}
      <section className="section-container pt-0">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
          Technical <span className="gradient-text">Skills</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {techStack.map((g) => (
            <div key={g.group} className="p-4 rounded-xl bg-card/50 border border-border">
              <h3 className="text-sm font-semibold mb-3">{g.group}</h3>
              <div className="flex flex-wrap gap-2">
                {g.items.map((i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground font-mono">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Research interests */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Research &amp; Technology <span className="gradient-text">Interests</span>
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Production systems ship through GrowHaz; items explored only as prototypes are marked as experimental
            research on this page.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {interests.map((i) => (
              <span key={i} className="text-sm px-3 py-1.5 rounded-full bg-card border border-border">
                {i}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Building GrowHaz */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto p-6 md:p-8 rounded-2xl bg-card border border-border text-center">
          <h2 className="text-2xl font-bold mb-4">Building GrowHaz</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            GrowHaz is the technology company/startup founded by Om Uikey. The company focuses on building software
            products and technology solutions around cybersecurity, artificial intelligence, automation and related
            digital technologies.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6 text-sm font-medium">
            <span className="px-3 py-1.5 rounded-lg bg-secondary">Om Uikey</span>
            <ArrowRight className="w-4 h-4 text-primary rotate-90 sm:rotate-0" />
            <span className="px-3 py-1.5 rounded-lg bg-secondary">Founder &amp; CEO</span>
            <ArrowRight className="w-4 h-4 text-primary rotate-90 sm:rotate-0" />
            <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">GrowHaz</span>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/">
              <Button variant="hero" size="lg">
                Explore GrowHaz <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg">
                About GrowHaz
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                Contact
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Connect */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Connect With Om Uikey</h2>
          {activeSocials.length ? (
            <div className="flex flex-wrap gap-3 justify-center">
              {activeSocials.map((s) => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="gap-2">
                    <s.icon className="w-4 h-4" />
                    {s.label}
                  </Button>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Verified profiles will be listed here. For now, reach out through the{" "}
              <Link to="/contact" className="text-primary font-medium">
                GrowHaz contact page
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="section-container pt-0">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faq.map((f) => (
              <div key={f.question} className="p-5 rounded-xl bg-card border border-border">
                <h3 className="text-base font-semibold mb-2">{f.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
