import { Layout } from "@/components/layout/Layout";
import { Shield, FileText } from "lucide-react";

export default function Terms() {
  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Legal</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Terms & <span className="gradient-text">Conditions</span>
            </h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using GROWHAZ services, you accept and agree to be bound by these Terms and Conditions. 
                If you do not agree to these terms, please do not use our services. These terms apply to all visitors, 
                users, and others who access or use our platform.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">2. Services Description</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                GROWHAZ provides cybersecurity tools, web development services, SEO optimization, automation solutions, 
                marketing services, and mentorship programs. Our services include but are not limited to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Website security scanning and vulnerability assessment</li>
                <li>Custom web development and application building</li>
                <li>Search engine optimization services</li>
                <li>Business automation and workflow solutions</li>
                <li>Digital marketing and growth strategies</li>
                <li>1-on-1 mentorship sessions with verified professionals</li>
              </ul>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                As a user of our services, you agree to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Provide accurate and complete information when creating an account</li>
                <li>Maintain the security of your account credentials</li>
                <li>Use our services only for lawful purposes</li>
                <li>Not attempt to gain unauthorized access to any systems or networks</li>
                <li>Not use our security tools to scan websites without proper authorization</li>
                <li>Respect intellectual property rights</li>
              </ul>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">4. Payment Terms</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For paid services and mentorship sessions:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>All fees are quoted in USD unless otherwise specified</li>
                <li>Payment is required before service delivery unless agreed otherwise</li>
                <li>Mentorship session fees are non-refundable once the session has been conducted</li>
                <li>Subscription services will auto-renew unless cancelled before the renewal date</li>
                <li>We reserve the right to modify pricing with 30 days advance notice</li>
              </ul>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">5. Mentorship Program Terms</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Learn & Mentorship program is subject to the following specific terms:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Mentorship is provided through 1-on-1 live sessions, not pre-recorded courses</li>
                <li>Session outcomes depend on learner effort and dedication</li>
                <li>Mentors are verified professionals but results are not guaranteed</li>
                <li>Rescheduling must be done at least 24 hours before the scheduled session</li>
                <li>No-shows will result in forfeiture of the session fee</li>
              </ul>
              <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Disclaimer:</strong> Learning outcomes vary based on individual 
                  effort, prior knowledge, and dedication. GROWHAZ and its mentors do not guarantee specific results 
                  or career outcomes from mentorship sessions.
                </p>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of our services, including but not limited to text, graphics, 
                logos, icons, images, audio clips, digital downloads, and software, are the exclusive property of 
                GROWHAZ and are protected by international copyright, trademark, patent, trade secret, and other 
                intellectual property laws.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                GROWHAZ shall not be liable for any indirect, incidental, special, consequential, or punitive damages, 
                including without limitation, loss of profits, data, use, goodwill, or other intangible losses, 
                resulting from your access to or use of or inability to access or use the services. Our total liability 
                shall not exceed the amount paid by you for the specific service in question.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">8. Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your use of our services is also governed by our Privacy Policy. We collect, use, and protect your 
                personal information in accordance with applicable data protection laws. By using our services, you 
                consent to the collection and use of information as outlined in our Privacy Policy.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account and access to our services immediately, without prior notice 
                or liability, for any reason whatsoever, including without limitation if you breach these Terms. Upon 
                termination, your right to use the services will immediately cease.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                provide at least 30 days notice prior to any new terms taking effect. What constitutes a material 
                change will be determined at our sole discretion.
              </p>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-4">11. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-secondary rounded-lg">
                <p className="text-foreground font-medium">GROWHAZ</p>
                <p className="text-muted-foreground">Email: contact@growhaz.com</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
