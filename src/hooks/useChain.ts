/**
 * Shared MetaMask signer + read-only Sepolia provider (through Alchemy proxy).
 * Use getContract(address, abi, { write }) to get a connected ethers.Contract.
 */
import { useCallback, useMemo } from "react";
import { ethers } from "ethers";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
const ALCHEMY_PROXY_URL = `${SUPABASE_URL}/functions/v1/alchemy-proxy?network=eth-sepolia`;

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";

export function useChain() {
  const readProvider = useMemo(() => {
    const req = new ethers.FetchRequest(ALCHEMY_PROXY_URL);
    if (SUPABASE_ANON_KEY) req.setHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    return new ethers.JsonRpcProvider(req, SEPOLIA_CHAIN_ID, { staticNetwork: true });
  }, []);

  const ensureSepolia = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const eth = (window as any).ethereum;
    const id = await eth.request({ method: "eth_chainId" });
    if (id !== SEPOLIA_CHAIN_HEX) {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_HEX }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_CHAIN_HEX,
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        } else throw e;
      }
    }
  }, []);

  const getSigner = useCallback(async () => {
    await ensureSepolia();
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return provider.getSigner();
  }, [ensureSepolia]);

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

  return { readProvider, getSigner, getContract, ensureSepolia };
}

export function getInstanceId(templateId: string, documentId: string): string {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "string"], [templateId, documentId]),
  );
}

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
