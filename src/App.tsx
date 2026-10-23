import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Load route code only when the visitor opens that page.
const Index = lazy(() => import("./pages/Index"));
const SecurityTools = lazy(() => import("./pages/SecurityTools"));
const Development = lazy(() => import("./pages/Development"));
const SEO = lazy(() => import("./pages/SEO"));
const Automation = lazy(() => import("./pages/Automation"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Projects = lazy(() => import("./pages/Projects"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Mentorship = lazy(() => import("./pages/Mentorship"));
const Blockchain = lazy(() => import("./pages/Blockchain"));
const VerifyDocument = lazy(() => import("./pages/VerifyDocument"));
const LearningRequests = lazy(() => import("./pages/LearningRequests"));
const Terms = lazy(() => import("./pages/Terms"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Wallet = lazy(() => import("./pages/Wallet"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForensicWhitepaper = lazy(() => import("./pages/ForensicWhitepaper"));
const FounderOmUikey = lazy(() => import("./pages/FounderOmUikey"));

import { FloatingInvestButton } from "@/components/FloatingInvestButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <FloatingInvestButton />
          <Suspense fallback={<div className="min-h-screen bg-background" aria-label="Loading page" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/security-tools" element={<SecurityTools />} />
              <Route path="/development" element={<Development />} />
              <Route path="/seo" element={<SEO />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/mentorship" element={<Mentorship />} />
              <Route path="/blockchain" element={<Blockchain />} />
              <Route path="/verify/:id" element={<VerifyDocument />} />
              <Route path="/learning-requests" element={<LearningRequests />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/forensic-whitepaper" element={<ForensicWhitepaper />} />
              <Route path="/founder/om-uikey" element={<FounderOmUikey />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
