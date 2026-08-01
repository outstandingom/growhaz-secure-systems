import { Seo } from "@/components/Seo";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ServicesOverview } from "@/components/home/ServicesOverview";
import { SecurityHighlight } from "@/components/home/SecurityHighlight";
import { ProjectsPreview } from "@/components/home/ProjectsPreview";
import { CTASection } from "@/components/home/CTASection";
import { FaqSection, homeFaq } from "@/components/home/FaqSection";

const Index = () => {
  return (
    <Layout>
      <Seo
        title="GrowHaz — Website Security Scanning & Blockchain Document Verification"
        description="GrowHaz is a cybersecurity and trust-infrastructure company offering automated website vulnerability scanning (Alpha G1/G2), blockchain document verification, forensic file analysis, secure web development and cybersecurity mentorship."
        path="/"
        faq={homeFaq}
      />
      <HeroSection />
      <ServicesOverview />
      <SecurityHighlight />
      <ProjectsPreview />
      <FaqSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
