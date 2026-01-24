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
        <main className="flex-1 pt-16 md:pt-20">{children}</main>
        <Footer />
      </div>
    </>
  );
}
