/**
 * useWeb3Wallet — Detects and manages MetaMask/Phantom wallet connection.
 * Provides wallet address, chain info, connection helpers, and on-chain
 * UserRegistry interactions (register/fetch/update user profile).
 */
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  USER_REGISTRY_ADDRESS,
  USER_REGISTRY_ABI,
} from "@/lib/contractConfig";

export interface OnChainUser {
  ipfsCid: string;
  name: string;
  profession: string;
  phoneHash: string;
  registeredAt: number;
  exists: boolean;
}

export interface Web3WalletState {
  walletAddress: string | null;
  walletType: "metamask" | "phantom" | null;
  chainId: string | null;
  isConnecting: boolean;
  onChainUser: OnChainUser | null;
  loadingOnChain: boolean;
  registeredUsersCount: number;

  // Actions
  connectMetaMask: () => Promise<string | null>;
  connectPhantom: () => Promise<string | null>;
  disconnect: () => void;
  fetchOnChainUser: (address?: string) => Promise<OnChainUser | null>;
  registerUserOnChain: (
    ipfsCid: string,
    name: string,
    profession: string,
    phoneHash: string
  ) => Promise<string>; // returns tx hash
  updateUserOnChain: (
    ipfsCid: string,
    name: string,
    profession: string,
    phoneHash: string
  ) => Promise<string>;
}

const WALLET_STORAGE_KEY = "growhaz_wallet";

export function useWeb3Wallet(): Web3WalletState {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"metamask" | "phantom" | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onChainUser, setOnChainUser] = useState<OnChainUser | null>(null);
  const [loadingOnChain, setLoadingOnChain] = useState(false);
  const [registeredUsersCount, setRegisteredUsersCount] = useState(0);

  // Restore persisted wallet on mount, or detect already-authorized MetaMask
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.type) {
          // Re-verify the wallet is still connected
          if (parsed.type === "metamask" && window.ethereum) {
            window.ethereum
              .request({ method: "eth_accounts" })
              .then((accounts: string[]) => {
                if (accounts.length > 0) {
                  setWalletAddress(accounts[0]);
                  setWalletType("metamask");
                  localStorage.setItem(
                    WALLET_STORAGE_KEY,
                    JSON.stringify({ address: accounts[0], type: "metamask" })
                  );
                  window.ethereum
                    .request({ method: "eth_chainId" })
                    .then((id: string) => setChainId(id));
                } else {
                  localStorage.removeItem(WALLET_STORAGE_KEY);
                }
              });
          } else if (parsed.type === "phantom" && window.solana?.isPhantom) {
            window.solana.connect({ onlyIfTrusted: true }).then(() => {
              const addr = window.solana.publicKey?.toString();
              if (addr) {
                setWalletAddress(addr);
                setWalletType("phantom");
              }
            }).catch(() => {
              localStorage.removeItem(WALLET_STORAGE_KEY);
            });
          }
        }
      } catch {
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    } else if (window.ethereum) {
      // No saved wallet, but check if MetaMask is already authorized
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setWalletType("metamask");
            localStorage.setItem(
              WALLET_STORAGE_KEY,
              JSON.stringify({ address: accounts[0], type: "metamask" })
            );
            window.ethereum
              .request({ method: "eth_chainId" })
              .then((id: string) => setChainId(id));
          }
        });
    }
  }, []);

  // Listen for MetaMask account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setWalletType(null);
        setOnChainUser(null);
        localStorage.removeItem(WALLET_STORAGE_KEY);
      } else if (walletType === "metamask") {
        setWalletAddress(accounts[0]);
        localStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({ address: accounts[0], type: "metamask" })
        );
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [walletType]);

  // Auto-fetch on-chain user when wallet connects
  useEffect(() => {
    if (walletAddress) {
      fetchOnChainUser(walletAddress);
    }
  }, [walletAddress]);

  const connectMetaMask = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) return null;
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      const network = await provider.getNetwork();

      setWalletAddress(address);
      setWalletType("metamask");
      setChainId("0x" + network.chainId.toString(16));
      localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ address, type: "metamask" })
      );
      return address;
    } catch {
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectPhantom = useCallback(async (): Promise<string | null> => {
    if (!window.solana?.isPhantom) return null;
    setIsConnecting(true);
    try {
      await window.solana.connect();
      const address = window.solana.publicKey?.toString() ?? null;
      if (address) {
        setWalletAddress(address);
        setWalletType("phantom");
        localStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({ address, type: "phantom" })
        );
      }
      return address;
    } catch {
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletAddress(null);
    setWalletType(null);
    setChainId(null);
    setOnChainUser(null);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  const fetchOnChainUser = useCallback(
    async (address?: string): Promise<OnChainUser | null> => {
      const target = address || walletAddress;
      if (!target) return null;

      setLoadingOnChain(true);
      try {
        // Use public Sepolia RPC for read-only calls — works even if MetaMask is on wrong network
        const SEPOLIA_RPCS = [
          "https://ethereum-sepolia-rpc.publicnode.com",
          "https://sepolia.drpc.org",
          "https://rpc2.sepolia.org",
          "https://rpc.sepolia.org",
        ];
        let provider: ethers.Provider | null = null;
        for (const rpc of SEPOLIA_RPCS) {
          try {
            const p = new ethers.JsonRpcProvider(rpc);
            await p.getBlockNumber(); // quick connectivity check
            provider = p;
            break;
          } catch { /* try next */ }
        }
        if (!provider) {
          // Last resort: MetaMask BrowserProvider
          if (!window.ethereum) throw new Error("No Sepolia provider available");
          provider = new ethers.BrowserProvider(window.ethereum);
        }
        const contract = new ethers.Contract(
          USER_REGISTRY_ADDRESS,
          USER_REGISTRY_ABI,
          provider
        );
        const result = await contract.getUser(target);
        // result: [ipfsCid, name, profession, phoneHash, registeredAt, exists]
        const user: OnChainUser = {
          ipfsCid: result[0],
          name: result[1],
          profession: result[2],
          phoneHash: result[3],
          registeredAt: Number(result[4]),
          exists: result[5],
        };
        setOnChainUser(user);
        console.log("[useWeb3Wallet] On-chain user fetched:", user);
        // Also fetch total registered users count
        try {
          const count = await contract.getRegisteredUsersCount();
          setRegisteredUsersCount(Number(count));
        } catch { /* ignore */ }
        return user;
      } catch (e) {
        console.error("Failed to fetch on-chain user:", e);
        setOnChainUser(null);
        return null;
      } finally {
        setLoadingOnChain(false);
      }
    },
    [walletAddress]
  );

  const registerUserOnChain = useCallback(
    async (
      ipfsCid: string,
      name: string,
      profession: string,
      phoneHash: string
    ): Promise<string> => {
      if (!window.ethereum) throw new Error("MetaMask not found");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        USER_REGISTRY_ADDRESS,
        USER_REGISTRY_ABI,
        signer
      );

      const tx = await contract.registerUser(ipfsCid, name, profession, phoneHash);
      const receipt = await tx.wait();
      // Refresh the on-chain user data
      await fetchOnChainUser();
      return receipt.hash;
    },
    [fetchOnChainUser]
  );

  const updateUserOnChain = useCallback(
    async (
      ipfsCid: string,
      name: string,
      profession: string,
      phoneHash: string
    ): Promise<string> => {
      if (!window.ethereum) throw new Error("MetaMask not found");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        USER_REGISTRY_ADDRESS,
        USER_REGISTRY_ABI,
        signer
      );

      const tx = await contract.updateProfile(ipfsCid, name, profession, phoneHash);
      const receipt = await tx.wait();
      // Refresh the on-chain user data
      await fetchOnChainUser();
      return receipt.hash;
    },
    [fetchOnChainUser]
  );

  return {
    walletAddress,
    walletType,
    chainId,
    isConnecting,
    onChainUser,
    loadingOnChain,
    registeredUsersCount,
    connectMetaMask,
    connectPhantom,
    disconnect,
    fetchOnChainUser,
    registerUserOnChain,
    updateUserOnChain,
  };
}
