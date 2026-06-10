
import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract } from "ethers";
import { USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI } from "@/lib/userRegistryV2Contract";

export interface OnChainUser {
  exists: boolean;
  ipfsCid: string;
  updatedAt: number;
  name?: string;
  profession?: string;
  age?: number;
  phoneHash?: string;
  emailHash?: string;
}

export function useWeb3Wallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [onChainUser, setOnChainUser] = useState<OnChainUser | null>(null);
  const [loadingOnChain, setLoadingOnChain] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"traditional" | "wallet">("traditional");

  // Helper: fetch on‑chain profile (read‑only)
  const fetchOnChainProfile = useCallback(async (address: string) => {
    if (!address) return null;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI, provider);
      const [ipfsHash, updatedAt] = await contract.getProfile(address);
      if (ipfsHash && ipfsHash !== "" && updatedAt > 0) {
        return {
          exists: true,
          ipfsCid: ipfsHash,
          updatedAt: Number(updatedAt),
        };
      }
    } catch (err) {
      console.warn("Failed to fetch on‑chain profile:", err);
    }
    return null;
  }, []);

  // Connect MetaMask
  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setWalletType("metamask");
      setLoginMethod("wallet");

      // Fetch on‑chain profile
      setLoadingOnChain(true);
      const profile = await fetchOnChainProfile(address);
      if (profile) {
        // Fetch full IPFS data if needed (can be done separately)
        setOnChainUser(profile as OnChainUser);
      } else {
        setOnChainUser(null);
      }
      setLoadingOnChain(false);
      return address;
    } catch (error: any) {
      console.error("Connection error:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchOnChainProfile]);

  // Connect Phantom (Ethereum-compatible version via MetaMask‑like provider)
  const connectPhantom = useCallback(async () => {
    // For Ethereum, Phantom does not natively provide an EIP‑1193 provider.
    // We fall back to MetaMask or show a message.
    throw new Error("Phantom is not supported for Ethereum. Please use MetaMask.");
  }, []);

  // Disconnect wallet (clear local state)
  const disconnect = useCallback(() => {
    setWalletAddress(null);
    setWalletType(null);
    setOnChainUser(null);
    setLoginMethod("traditional");
  }, []);

  // Register user on‑chain (using the contract)
  const registerUserOnChain = useCallback(async (ipfsCid: string) => {
    if (!walletAddress) throw new Error("No wallet connected");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI, signer);
    const tx = await contract.registerOrUpdate(ipfsCid);
    const receipt = await tx.wait();
    return receipt.hash;
  }, [walletAddress]);

  // Update user on‑chain (same function, contract uses registerOrUpdate)
  const updateUserOnChain = registerUserOnChain;

  // Refresh on‑chain profile after registration
  const refreshOnChainProfile = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingOnChain(true);
    const profile = await fetchOnChainProfile(walletAddress);
    setOnChainUser(profile as OnChainUser | null);
    setLoadingOnChain(false);
  }, [walletAddress, fetchOnChainProfile]);

  // Auto‑connect if wallet was previously connected (optional)
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum && window.ethereum.selectedAddress) {
        try {
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setWalletAddress(address);
          setWalletType("metamask");
          setLoginMethod("wallet");
          const profile = await fetchOnChainProfile(address);
          setOnChainUser(profile as OnChainUser | null);
        } catch {
          // Ignore
        }
      }
    };
    checkConnection();
  }, [fetchOnChainProfile]);

  return {
    walletAddress,
    walletType,
    onChainUser,
    loadingOnChain,
    isConnecting,
    loginMethod,
    connectMetaMask,
    connectPhantom,
    disconnect,
    registerUserOnChain,
    updateUserOnChain,
    refreshOnChainProfile,
  };
}
