import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Page Imports
import ResetPassword from "@/pages/ResetPassword";
import Index from "./pages/Index";
import SecurityTools from "./pages/SecurityTools";
import Development from "./pages/Development";
import SEO from "./pages/SEO";
import Automation from "./pages/Automation";
import Marketing from "./pages/Marketing";
import Projects from "./pages/Projects";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Mentorship from "./pages/Mentorship";
import LearningRequests from "./pages/LearningRequests";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Wallet from "./pages/Wallet";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

// New Component Import
import { FloatingInvestButton } from "@/components/FloatingInvestButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        
        {/* The floating button is placed here so it shows on every page */}
        <FloatingInvestButton />

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
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/mentorship" element={<Mentorship />} />
          <Route path="/mentorshi" element={<Mentorship />} />
          <Route path="/learning-requests" element={<LearningRequests />} />
          <Route path="/learn" element={<Mentorship />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/admin" element={<AdminDashboard />} />
        
// Inside your Router
<Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
