import { FC, useState } from "react";
import { BrowserProvider } from "ethers";
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    ethereum?: any;
    solana?: any;
  }
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  cursor: "pointer",
  background: "transparent",
  color: "inherit",
  width: "100%",
};

const Web3Login: FC = () => {
  const [loading, setLoading] = useState<"metamask" | "phantom" | null>(null);
  const { toast } = useToast();

  const loginMetaMask = async () => {
    if (!window.ethereum) {
      toast({ title: "MetaMask not found", description: "Please install MetaMask.", variant: "destructive" });
      return;
    }
    setLoading("metamask");
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const { data, error } = await (supabase.auth as any).signInWithWeb3({
        chain: "ethereum",
        statement: "I accept the Terms of Service. Sign in to authenticate.",
        signer,
        domain: window.location.host,      // e.g., www.growhaz.com or localhost:8080
        uri: window.location.origin,       // e.g., https://www.growhaz.com or http://localhost:8080
      });
      if (error) throw error;
      toast({ title: "Connected", description: `Signed in as ${address.slice(0, 6)}...${address.slice(-4)}` });
    } catch (e: any) {
      toast({ title: "MetaMask login failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const loginPhantom = async () => {
    const phantom = window.solana;
    if (!phantom?.isPhantom) {
      toast({ title: "Phantom not found", description: "Please install Phantom wallet.", variant: "destructive" });
      return;
    }
    setLoading("phantom");
    try {
      await phantom.connect();

      const { data, error } = await (supabase.auth as any).signInWithWeb3({
        chain: "solana",
        statement: "I accept the Terms of Service. Sign in to authenticate.",
        wallet: phantom,
      });
      if (error) {
        // Fallback: manual sign-in if signInWithWeb3 unavailable on this client
        const address = phantom.publicKey.toString();
        const message = `Sign in to authenticate.\nAddress: ${address}\nNonce: ${crypto.randomUUID()}`;
        const encoded = new TextEncoder().encode(message);
        const signed = await phantom.signMessage(encoded, "utf8");
        const signature = bs58.encode(signed.signature);
        throw new Error(error.message || `SIWS not available. Signed locally: ${signature.slice(0, 10)}...`);
      }
      toast({ title: "Connected", description: "Signed in with Phantom" });
    } catch (e: any) {
      toast({ title: "Phantom login failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: 280 }}>
      <button onClick={loginMetaMask} disabled={loading !== null} style={btnStyle}>
        {loading === "metamask" ? "Connecting..." : "Continue with MetaMask"}
      </button>
      <button onClick={loginPhantom} disabled={loading !== null} style={btnStyle}>
        {loading === "phantom" ? "Connecting..." : "Continue with Phantom"}
      </button>
    </div>
  );
};

export default Web3Login;
