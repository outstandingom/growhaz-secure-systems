import { Layout } from "@/components/layout/Layout";
import { Shield, Target, Cpu, CheckCircle2 } from "lucide-react";

export default function ForensicWhitepaper() {
  return (
    <Layout>
      <div className="bg-background min-h-screen pb-20">
        {/* Header Hero */}
        <section className="pt-32 pb-16 px-4 border-b border-border bg-card/30">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <Shield className="w-4 h-4" />
              GrowHaz Security Research
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              The GrowHaz Forensic Engine
            </h1>
            <p className="text-xl text-muted-foreground font-light">
              A New Standard in Automated Digital Forensics & Evidence Collection
            </p>
          </div>
        </section>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 mt-12 space-y-12 text-foreground/90">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Executive Summary</h2>
            <p className="leading-relaxed">
              In the rapidly evolving landscape of digital media, verifying the authenticity of images and documents has never been more critical. The <strong>GrowHaz Forensic Engine</strong> represents a paradigm shift in how digital forensics is conducted. Moving away from manual, heavy desktop applications and opaque "AI guesses," our engine provides a unified, automated, and mathematically deterministic cloud API.
            </p>
            <p className="leading-relaxed">
              This whitepaper details what makes the GrowHaz engine unique, what it tests, and why it is positioned to become an enterprise standard for legal, financial, and security compliance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">The Problem with Current Tools</h2>
            <p className="leading-relaxed">
              The digital forensics market currently suffers from two major extremes:
            </p>
            <ul className="space-y-4 mt-4">
              <li className="flex gap-3">
                <Target className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                <span>
                  <strong>Legacy Desktop Software:</strong> Tools like EnCase and FTK are the industry standard for law enforcement, but they are incredibly expensive, require specialized training, and are completely manual. They cannot be easily integrated into automated API pipelines (e.g., verifying KYC documents on a fintech app).
                </span>
              </li>
              <li className="flex gap-3">
                <Target className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                <span>
                  <strong>"Black Box" AI Detectors:</strong> A recent surge of deepfake detection startups relies purely on Neural Networks that output a "confidence score" (e.g., "90% chance this is fake"). These are fundamentally flawed for legal and compliance use cases because they suffer from high false-positive rates and cannot explain <em>why</em> they flagged a file.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Why The GrowHaz Engine is Unique</h2>
            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <div className="p-6 rounded-2xl border border-border bg-card">
                <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Deterministic Evidence</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The engine does not guess. It was intentionally architected to be "predictionless." Instead of a vague risk score, it acts as an automated investigator, outputting concrete mathematical facts (e.g., PRNU inconsistency, ELA degradation).
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-border bg-card">
                <Cpu className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">37 Checks in 1 API</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Instead of relying on fragmented open-source scripts (one for metadata, one for pixels, one for PDFs), GrowHaz unifies 37 distinct forensic extractors into one massive pipeline.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">What Does The Engine Actually Test?</h2>
            <div className="space-y-6 mt-6">
              <div className="pl-4 border-l-2 border-primary/40">
                <h3 className="font-semibold text-lg">1. File Integrity & Metadata</h3>
                <p className="text-muted-foreground text-sm mt-1">Pulls hidden EXIF/XMP metadata to check the software used to save the file (e.g., GIMP, Photoshop) and verifies cryptographic hashes.</p>
              </div>
              <div className="pl-4 border-l-2 border-primary/40">
                <h3 className="font-semibold text-lg">2. Editing & Manipulation Detection</h3>
                <p className="text-muted-foreground text-sm mt-1">Uses Error Level Analysis (ELA) to analyze JPEG compression rates and scans for cloned pixels to detect if a signature or date was copy-pasted.</p>
              </div>
              <div className="pl-4 border-l-2 border-primary/40">
                <h3 className="font-semibold text-lg">3. Camera Origin & Sensor Noise (PRNU)</h3>
                <p className="text-muted-foreground text-sm mt-1">Analyzes microscopic camera sensor hardware defects to see if different parts of an image came from different physical cameras.</p>
              </div>
              <div className="pl-4 border-l-2 border-primary/40">
                <h3 className="font-semibold text-lg">4. Document Forensics & Fonts</h3>
                <p className="text-muted-foreground text-sm mt-1">Detects multiple fonts or embedded text layers on flat scanned documents, a strong indicator of invoice or identity tampering.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Market Positioning & Pricing</h2>
            <p className="leading-relaxed">
              Given the immense value and computational cost of running 37 deep mathematical checks simultaneously, the GrowHaz Forensic Engine commands premium enterprise pricing, while still remaining far more cost-effective than manual desktop alternatives.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-muted-foreground">
              <li><strong>Pay-As-You-Go API:</strong> $1.50 to $3.00 per scan. Ideal for KYC and fintech platforms.</li>
              <li><strong>Enterprise SaaS Subscription:</strong> Starting at $500/month for private investigators and security teams.</li>
              <li><strong>On-Premise / Air-Gapped License:</strong> $40,000+ per year. Designed for Law Enforcement and Government entities requiring absolute data privacy.</li>
            </ul>
          </section>

          <div className="pt-10 border-t border-border text-center text-sm text-muted-foreground">
            <p>Authored by the GrowHaz Security Research Team.</p>
          </div>
        </article>
      </div>
    </Layout>
  );
}
