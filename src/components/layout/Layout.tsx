import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { NeuralBackground } from "@/components/background/NeuralBackground";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <NeuralBackground />
      <div className="min-h-screen flex flex-col relative z-10">
        <Navbar />
        <main className="flex-1 pt-16 md:pt-20 relative">
          <div className="pointer-events-none absolute inset-x-3 md:inset-x-6 top-3 bottom-3 rounded-3xl site-glass" aria-hidden />
          <div className="relative z-10">{children}</div>
        </main>
        <Footer />
      </div>
    </>
  );
}
