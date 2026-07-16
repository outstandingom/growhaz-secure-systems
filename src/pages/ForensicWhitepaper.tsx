import { Layout } from "@/components/layout/Layout";
import {
  Shield,
  Target,
  Cpu,
  CheckCircle2,
  FileText,
  Scan,
  Fingerprint,
  Eye,
  File,
  Waves,
} from "lucide-react";

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

          {/* New Detailed Section */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground">
              Deep-Dive: The Six Forensic Modules
            </h2>
            <p className="leading-relaxed">
              Because we refactored the engine to be predictionless, it acts as an objective, mathematical investigator. It takes a file, runs it through 6 major categories (containing 37 distinct mathematical checks), and outputs a massive JSON evidence report. Here is the complete breakdown of every test, the exact reports it generates, and the real-world enterprise use cases for each.
            </p>

            {/* 1. Metadata & Provenance */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">1. Metadata &amp; Provenance (The Digital Footprint)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> It rips apart the hidden data embedded inside the file. When a camera takes a photo, or when software edits a photo, it leaves a hidden signature.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>EXIF Extraction:</strong> Pulls the camera hardware details, GPS coordinates, and exact timestamp of the shot.</li>
                  <li><strong>XMP / IPTC Extraction:</strong> Pulls Adobe XML data.</li>
                </ul>
                <p>
                  <strong>The Report it Generates:</strong> You get a clean JSON list of the exact software used to touch the file (e.g., <code>Software: Adobe Photoshop 2024</code>, or <code>Model: iPhone 15 Pro Max</code>).
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    Insurance Fraud. A user submits a photo of a dented car for a $5,000 insurance claim. The metadata reveals the photo was taken 3 years ago and was saved using "GIMP" (photo editing software). Claim denied instantly.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Compression & Pixel Tampering */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Scan className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">2. Compression &amp; Pixel Tampering (Visual Forgery)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> It looks for human tampering (splicing, copy‑pasting, erasing) at the pixel level.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    <strong>Error Level Analysis (ELA):</strong> When you save a JPEG, it compresses. If you paste a new signature onto an old document and hit save, the new signature has been compressed once, but the old document has been compressed twice. ELA highlights these compression differences.
                  </li>
                  <li>
                    <strong>Copy‑Move Detection:</strong> Scans the entire image looking for exact duplicate blocks of pixels.
                  </li>
                </ul>
                <p>
                  <strong>The Report it Generates:</strong> A JSON array of "anomalies." It flags the exact (X, Y) coordinates of the image where compression degradation doesn't match the background, or where pixels were cloned.
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    KYC / Identity Verification (Fintech). A user submits a picture of a passport to open a crypto account. ELA shows that the birthdate has a massive compression difference compared to the rest of the passport. They changed their age.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Sensor Noise Fingerprinting (PRNU) */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">3. Sensor Noise Fingerprinting (PRNU)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> PRNU (Photo Response Non‑Uniformity) is like a microscopic fingerprint for camera hardware. No two camera sensors on earth are manufactured perfectly. Every camera leaves a faint, invisible static "noise" pattern on its photos.
                </p>
                <p>
                  <strong>The Report it Generates:</strong> The engine strips away the picture (the face, trees, cars) and extracts just the camera noise. It then checks if the noise is consistent across the entire image.
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    Deep Splicing Detection (Law Enforcement). A criminal splices a victim's face onto illegal material. To the naked eye, and even to ELA, it might look perfect. But PRNU reveals that the noise pattern on the face belongs to an iPhone, while the noise pattern on the background belongs to a Canon DSLR. It proves the image is a composite of two different photos.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Steganography Detection */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">4. Steganography Detection (Hidden Payloads)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> Steganography is the art of hiding a secret file inside an image file by altering the Least Significant Bit (LSB) of the pixels. A standard color pixel has a value between 0‑255. If you change a 254 to a 255, the human eye cannot see the color difference, but a computer can use that 1 bit of difference to hide a text file.
                </p>
                <p>
                  <strong>The Report it Generates:</strong> It measures the mathematical entropy (randomness) of the image's bits. If it detects an unnatural spike in entropy, it extracts the hidden binary payload and attempts to decode it into text.
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    Corporate Espionage &amp; Cybersecurity. A rogue employee tries to steal a text file containing 10,000 customer credit cards. Their email blocks text files, so they use steganography to hide the credit cards inside a picture of a dog, and email the dog picture to themselves. Your engine intercepts the image, detects the entropy spike, and rips the hidden credit cards out of the pixels.
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Document Forensics */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <File className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">5. Document Forensics (PDFs &amp; Scans)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> Not all forensic checks are for photos. Scanned documents and PDFs have their own unique vulnerabilities.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Font &amp; Glyph Extraction:</strong> It scans the document to see how many different hidden fonts are embedded in the file.</li>
                  <li><strong>Timestamp Cross‑Referencing:</strong> Checks the PDF creation date against the internal modification dates.</li>
                </ul>
                <p>
                  <strong>The Report it Generates:</strong> A breakdown of document layers. For example, it will flag if a "scanned" document actually contains editable vector text layers hidden beneath the image.
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    Invoice Fraud / Embezzlement. An employee takes a legitimate $1,000 PDF invoice, uses a PDF editor to change the payment routing number to their own bank account, and submits it to HR. The engine flags that the PDF modification date is newer than the creation date, and that two different font encodings exist on the document.
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Frequency Domain Analysis (Generative AI) */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Waves className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">6. Frequency Domain Analysis (Generative AI)</h3>
              </div>
              <div className="pl-8 space-y-2 text-sm">
                <p>
                  <strong>What it does:</strong> Instead of using an unreliable AI to guess if a photo is AI‑generated, your engine uses the Fast Fourier Transform (FFT) to view the image in the "Frequency Domain" (as waves of light rather than pixels).
                </p>
                <p>
                  <strong>The Report it Generates:</strong> When AI models (like Midjourney or Stable Diffusion) generate faces, they are mathematically "too perfect." They leave a highly unnatural, grid‑like pattern in the high frequencies of the image that no real camera lens would ever produce. The engine outputs a frequency anomaly report.
                </p>
                <div className="bg-card p-4 rounded-lg border border-border">
                  <p className="font-medium text-foreground">Real‑World Use Case:</p>
                  <p className="text-muted-foreground">
                    Dating Apps / Catfishing. A user uploads a profile picture generated entirely by an AI to run a romance scam. ELA won't catch it (because it was never spliced, it was generated from scratch). PRNU won't catch it. But the FFT module will immediately flag the unnatural high‑frequency grid artifacts, proving a real camera never captured the photo.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Market Positioning (existing) */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Market Positioning &amp; Pricing</h2>
            <p className="leading-relaxed">
              Given the immense value and computational cost of running 37 deep mathematical checks simultaneously, the GrowHaz Forensic Engine commands premium enterprise pricing, while still remaining far more cost-effective than manual desktop alternatives.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-4 text-muted-foreground">
              <li><strong>Pay‑As‑You‑Go API:</strong> $1.50 to $3.00 per scan. Ideal for KYC and fintech platforms.</li>
              <li><strong>Enterprise SaaS Subscription:</strong> Starting at $500/month for private investigators and security teams.</li>
              <li><strong>On‑Premise / Air‑Gapped License:</strong> $40,000+ per year. Designed for Law Enforcement and Government entities requiring absolute data privacy.</li>
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
