import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Answer-engine friendly Q&A. The same list is emitted as FAQPage JSON-LD
 * from the home page so assistants can quote GrowHaz directly.
 */
export const homeFaq = [
  {
    question: "What is GrowHaz?",
    answer:
      "GrowHaz is an Indian cybersecurity and trust-infrastructure company. It provides automated website vulnerability scanning (Alpha G1 and Alpha G5), blockchain-based document verification, forensic file analysis, secure web development, SEO and one-to-one cybersecurity mentorship.",
  },
  {
    question: "How does GrowHaz scan a website for vulnerabilities?",
    answer:
      "GrowHaz runs two scanner tiers. Alpha G1 covers essential checks such as headers, exposed endpoints and common misconfigurations. Alpha G5 is the professional tier and adds JavaScript crawling, API and OpenAPI testing and deeper attack-surface coverage. Every scan returns a structured report with severity levels, evidence and remediation steps.",
  },
  {
    question: "How does GrowHaz verify that a document is authentic?",
    answer:
      "Each document gets three independent proofs: a file hash, a content hash built from chunked extracted text, and a Merkle evidence root. These proofs are anchored on-chain, so any later edit to the document breaks the match and is detected instantly.",
  },
  {
    question: "Can GrowHaz show the full history of a document or process?",
    answer:
      "Yes. GrowHaz smart contracts (UserRegistry, ProcessManager, StepManager, TimelineLogger, AuthorizationRegistry and DocumentAccessControl) record who performed each step, when it happened, who verified it and under whose authority. This creates a tamper-proof timeline for use cases such as property transfers, insurance claims and certificate issuance.",
  },
  {
    question: "Does GrowHaz convert a website into a mobile app?",
    answer:
      "Yes. The GrowHaz website-to-app converter turns any website into an Android APK starting at ₹49, with custom branding from ₹99, push notifications and offline mode from ₹499, and Play Store AAB bundles plus AdMob on the ₹999 pro tier. iOS builds unlock from the ₹99 tier upwards.",
  },
  {
    question: "Who should use GrowHaz?",
    answer:
      "Startups and businesses that need an affordable website security audit, organisations that must prove document authenticity and process provenance, and individuals who want mentorship in cybersecurity from verified mentors with escrow-protected bookings.",
  },
];

export function FaqSection() {
  return (
    <section className="section-container px-4 sm:px-6" id="faq">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground text-center mb-8">
          Everything about GrowHaz security scanning, document verification and tooling.
        </p>

        <Accordion type="single" collapsible className="w-full">
          {homeFaq.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm sm:text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export default FaqSection;
