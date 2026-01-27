import { Layout } from "@/components/layout/Layout";
import { Shield, Lock, Eye, Database, Mail, Globe } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <section className="section-container">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: January 27, 2026
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Introduction */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                At GROWHAZ, we are committed to protecting your privacy and ensuring the security of your personal information. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
                website, services, and products. By using our services, you consent to the data practices described in this policy.
              </p>
            </div>

            {/* Information We Collect */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Information We Collect
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Personal Information</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Name and contact information (email address, phone number)</li>
                    <li>Account credentials (username, encrypted password)</li>
                    <li>Billing and payment information</li>
                    <li>Company or organization details (if applicable)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Technical Information</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>IP address and browser type</li>
                    <li>Device information and operating system</li>
                    <li>Usage data and interaction patterns</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Security Scan Data</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Website URLs submitted for security scanning</li>
                    <li>Scan results and vulnerability reports</li>
                    <li>Security assessment data</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* How We Use Your Information */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>To provide and maintain our services, including security scanning tools</li>
                <li>To process transactions and send related information</li>
                <li>To communicate with you about services, updates, and promotional offers</li>
                <li>To improve our website and services based on usage patterns</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
                <li>To comply with legal obligations and protect our rights</li>
                <li>To facilitate mentorship bookings and session management</li>
              </ul>
            </div>

            {/* Data Security */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We implement industry-standard security measures to protect your personal information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>SSL/TLS encryption for all data transmissions</li>
                <li>Secure data storage with access controls</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Employee training on data protection practices</li>
                <li>Row-level security policies for database access</li>
              </ul>
            </div>

            {/* Data Sharing */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Data Sharing and Disclosure
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your data only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Service Providers:</strong> With trusted partners who assist in operating our services</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our legal rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>Consent:</strong> When you have given explicit consent for sharing</li>
              </ul>
            </div>

            {/* Your Rights */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4">Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You have the following rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Access:</strong> Request a copy of your personal data we hold</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to processing of your personal data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
              </ul>
            </div>

            {/* Cookies */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4">Cookies Policy</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use cookies and similar technologies to enhance your experience:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Essential Cookies:</strong> Required for basic site functionality</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our site</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You can manage cookie preferences through your browser settings.
              </p>
            </div>

            {/* Contact */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Contact Us
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-4 p-4 rounded-xl bg-secondary/50">
                <p className="font-medium">GROWHAZ</p>
                <p className="text-muted-foreground">Email: contact@growhaz.com</p>
              </div>
            </div>

            {/* Updates */}
            <div className="p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border">
              <h2 className="text-xl font-semibold mb-4">Policy Updates</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
                Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy 
                Policy periodically for any changes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
