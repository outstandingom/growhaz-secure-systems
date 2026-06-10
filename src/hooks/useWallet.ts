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
  fullIpfsData?: any;
}

export function useWeb3Wallet() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [onChainUser, setOnChainUser] = useState<OnChainUser | null>(null);
  const [loadingOnChain, setLoadingOnChain] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"traditional" | "wallet">("traditional");

  const fetchOnChainProfile = useCallback(async (address: string): Promise<OnChainUser | null> => {
    if (!address) return null;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI, provider);
      const [ipfsHash, updatedAt] = await contract.getProfile(address);
      if (ipfsHash && ipfsHash !== "" && updatedAt > 0) {
        const profile: OnChainUser = { exists: true, ipfsCid: ipfsHash, updatedAt: Number(updatedAt) };
        try {
          const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
          if (res.ok) {
            profile.fullIpfsData = await res.json();
            profile.name = profile.fullIpfsData.name;
            profile.profession = profile.fullIpfsData.profession;
            profile.age = profile.fullIpfsData.age;
            profile.phoneHash = profile.fullIpfsData.phoneHash;
            profile.emailHash = profile.fullIpfsData.emailHash;
          }
        } catch (err) { console.warn("IPFS fetch failed", err); }
        return profile;
      }
    } catch (err) { console.warn("Failed to fetch on‑chain profile:", err); }
    return null;
  }, []);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setWalletType("metamask");
      setLoginMethod("wallet");
      setLoadingOnChain(true);
      const profile = await fetchOnChainProfile(address);
      setOnChainUser(profile);
      setLoadingOnChain(false);
      return address;
    } catch (error: any) {
      console.error("Connection error:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchOnChainProfile]);

  const connectPhantom = useCallback(async () => {
    throw new Error("Phantom is not supported for Ethereum. Please use MetaMask.");
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
    setWalletType(null);
    setOnChainUser(null);
    setLoginMethod("traditional");
  }, []);

  const registerOrUpdateOnChain = useCallback(async (ipfsCid: string): Promise<string> => {
    if (!walletAddress) throw new Error("No wallet connected");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(USER_REGISTRY_V2_ADDRESS, USER_REGISTRY_V2_ABI, signer);
    const tx = await contract.registerOrUpdate(ipfsCid);
    const receipt = await tx.wait();
    return receipt.hash;
  }, [walletAddress]);

  const refreshOnChainProfile = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingOnChain(true);
    const profile = await fetchOnChainProfile(walletAddress);
    setOnChainUser(profile);
    setLoadingOnChain(false);
  }, [walletAddress, fetchOnChainProfile]);

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
          setOnChainUser(profile);
        } catch { /* ignore */ }
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
    registerOrUpdateOnChain,
    refreshOnChainProfile,
  };
}
