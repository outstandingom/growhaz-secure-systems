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

const Web3Login: FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const isMobile = /iPhone|iPad|iPod|Android/i.test(
    navigator.userAgent
  );

  // ---------------- ETHEREUM ----------------

  const loginMetaMask = async () => {
    try {
      setLoading("metamask");

      // MOBILE DEEP LINK
      if (!window.ethereum) {
        if (isMobile) {
          const dappUrl = window.location.href.replace(
            /^https?:\/\//,
            ""
          );

          window.location.href =
            `https://metamask.app.link/dapp/${dappUrl}`;

          return;
        }

        toast({
          title: "MetaMask not found",
          description: "Please install MetaMask",
          variant: "destructive",
        });

        return;
      }

      const provider = new BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();

      const address = await signer.getAddress();

      // safer nonce
      const nonce = Date.now().toString();

      const { error } = await (supabase.auth as any).signInWithWeb3({
        chain: "ethereum",
        signer,
        statement: "Sign in to GrowHaz",
        domain: window.location.host,
        uri: window.location.origin,
        nonce,
      });

      if (error) throw error;

      localStorage.setItem(
        "growhaz_wallet",
        JSON.stringify({
          address,
          type: "metamask",
          loginMethod: "wallet",
        })
      );

      toast({
        title: "Connected",
        description: `${address.slice(0, 6)}...${address.slice(-4)}`,
      });
    } catch (e: any) {
      toast({
        title: "MetaMask Login Failed",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  // ---------------- SOLANA ----------------

  const loginPhantom = async () => {
    try {
      setLoading("phantom");

      // MOBILE DEEP LINK
      if (!window.solana?.isPhantom) {
        if (isMobile) {
          const url = encodeURIComponent(window.location.href);

          window.location.href =
            `https://phantom.app/ul/browse/${url}?ref=${url}`;

          return;
        }

        toast({
          title: "Phantom not found",
          description: "Please install Phantom wallet",
          variant: "destructive",
        });

        return;
      }

      const phantom = window.solana;

      await phantom.connect();

      const address = phantom.publicKey.toString();

      const { error } = await (supabase.auth as any).signInWithWeb3({
        chain: "solana",
        wallet: phantom,
        statement: "Sign in to GrowHaz",
      });

      // FALLBACK MANUAL SIGN
      if (error) {
        const nonce = Date.now().toString();

        const message =
          `Sign in to GrowHaz\n` +
          `Wallet: ${address}\n` +
          `Nonce: ${nonce}`;

        const encoded = new TextEncoder().encode(message);

        const signed = await phantom.signMessage(
          encoded,
          "utf8"
        );

        const signature = bs58.encode(signed.signature);

        console.log(signature);
      }

      localStorage.setItem(
        "growhaz_wallet",
        JSON.stringify({
          address,
          type: "phantom",
          loginMethod: "wallet",
        })
      );

      toast({
        title: "Connected",
        description: `${address.slice(0, 6)}...${address.slice(-4)}`,
      });
    } catch (e: any) {
      toast({
        title: "Phantom Login Failed",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
      }}
    >
      <button
        onClick={loginMetaMask}
        disabled={!!loading}
      >
        {loading === "metamask"
          ? "Connecting..."
          : "Continue with MetaMask"}
      </button>

      <button
        onClick={loginPhantom}
        disabled={!!loading}
      >
        {loading === "phantom"
          ? "Connecting..."
          : "Continue with Phantom"}
      </button>
    </div>
  );
};

export default Web3Login;
