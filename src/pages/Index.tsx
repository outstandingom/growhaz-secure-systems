import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ServicesOverview } from "@/components/home/ServicesOverview";
import { SecurityHighlight } from "@/components/home/SecurityHighlight";
import { ProjectsPreview } from "@/components/home/ProjectsPreview";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ServicesOverview />
      <SecurityHighlight />
      <ProjectsPreview />
      <CTASection />
    </Layout>
  );
};

export default Index;
