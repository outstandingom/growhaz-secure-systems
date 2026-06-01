/**
 * WalletGate — drop-in MetaMask connect + Sepolia chain enforcement.
 * Shows children only when wallet is connected on Sepolia.
 */
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { useChain, SEPOLIA_CHAIN_HEX } from "@/hooks/useChain";
import { Button } from "@/components/ui/button";
import { Wallet, AlertTriangle, Loader2 } from "lucide-react";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const { walletAddress, chainId, connectMetaMask, isConnecting } = useWeb3Wallet();
  const { ensureSepolia } = useChain();

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card/50 border border-border">
        <Wallet className="w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground text-center">
          Connect MetaMask to use on-chain registries.
        </p>
        <Button onClick={() => connectMetaMask(false)} disabled={isConnecting}>
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
          Connect MetaMask
        </Button>
      </div>
    );
  }
  if (chainId && chainId !== SEPOLIA_CHAIN_HEX) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm">Switch your wallet to <strong>Sepolia</strong>.</p>
        <Button size="sm" onClick={() => ensureSepolia()}>Switch to Sepolia</Button>
      </div>
    );
  }
  return <>{children}</>;
}
