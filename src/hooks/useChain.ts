/**
 * Shared MetaMask signer + read-only Polygon Amoy provider (through Alchemy proxy).
 * Use getContract(address, abi, { write }) to get a connected ethers.Contract.
 *
 * Network: Polygon Amoy testnet (chainId 80002).
 * Legacy SEPOLIA_* exports are kept as aliases so other files keep working,
 * but they now point at Amoy values.
 */
import { useCallback, useMemo } from "react";
import { ethers } from "ethers";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
const ALCHEMY_PROXY_URL = `${SUPABASE_URL}/functions/v1/alchemy-proxy?network=polygon-amoy`;

export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_HEX = "0x13882";
export const AMOY_EXPLORER = "https://amoy.polygonscan.com";
export const AMOY_NAME = "Polygon Amoy";
export const AMOY_SYMBOL = "POL";

// Legacy aliases (other files import these names) — now point at Amoy.
export const SEPOLIA_CHAIN_ID = AMOY_CHAIN_ID;
export const SEPOLIA_CHAIN_HEX = AMOY_CHAIN_HEX;
export const SEPOLIA_EXPLORER = AMOY_EXPLORER;

export function useChain() {
  const readProvider = useMemo(() => {
    const req = new ethers.FetchRequest(ALCHEMY_PROXY_URL);
    if (SUPABASE_ANON_KEY) req.setHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    return new ethers.JsonRpcProvider(req, AMOY_CHAIN_ID, { staticNetwork: true });
  }, []);

  const ensureAmoy = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const eth = (window as any).ethereum;
    const id = await eth.request({ method: "eth_chainId" });
    if (id !== AMOY_CHAIN_HEX) {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: AMOY_CHAIN_HEX }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: AMOY_CHAIN_HEX,
              chainName: AMOY_NAME,
              nativeCurrency: { name: "POL", symbol: AMOY_SYMBOL, decimals: 18 },
              rpcUrls: ["https://rpc-amoy.polygon.technology"],
              blockExplorerUrls: [AMOY_EXPLORER],
            }],
          });
        } else throw e;
      }
    }
  }, []);

  // Legacy name kept for existing callers.
  const ensureSepolia = ensureAmoy;

  const getSigner = useCallback(async () => {
    await ensureAmoy();
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return provider.getSigner();
  }, [ensureAmoy]);

  const getContract = useCallback(
    async (address: string, abi: any, opts?: { write?: boolean }) => {
      if (!address) throw new Error("Contract address not configured. Deploy & set VITE_*_ADDRESS in .env.");
      if (opts?.write) {
        const signer = await getSigner();
        return new ethers.Contract(address, abi, signer);
      }
      return new ethers.Contract(address, abi, readProvider);
    },
    [getSigner, readProvider],
  );

  return { readProvider, getSigner, getContract, ensureAmoy, ensureSepolia };
}

export function getInstanceId(templateId: string, documentId: string): string {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "string"], [templateId, documentId]),
  );
}
