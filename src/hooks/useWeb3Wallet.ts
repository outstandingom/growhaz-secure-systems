/**
 * useWeb3Wallet — Detects and manages MetaMask/Phantom wallet connection.
 * Provides wallet address, chain info, connection helpers, and on-chain
 * UserRegistry interactions (register/fetch/update user profile) including age + emailHash.
 */
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  USER_REGISTRY_ADDRESS,
  USER_REGISTRY_ABI,
} from "@/lib/contractConfig";
import {
  indexUserRegistration,
  extractReceiptFields,
} from "@/lib/blockchainIndexer";

export interface OnChainUser {
  ipfsCid: string;
  name: string;
  profession: string;
  phoneHash: string;
  age: number;
  emailHash: string;
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
  loginMethod: "wallet" | "traditional";

  // Actions
  connectMetaMask: (isAuthLogin?: boolean) => Promise<string | null>;
  connectPhantom: (isAuthLogin?: boolean) => Promise<string | null>;
  disconnect: () => void;
  fetchOnChainUser: (address?: string) => Promise<OnChainUser | null>;
  registerUserOnChain: (
    ipfsCid: string,
    name: string,
    profession: string,
    phoneHash: string,
    age: number,
    emailHash: string
  ) => Promise<string>;
  updateUserOnChain: (
    ipfsCid: string,
    name: string,
    profession: string,
    phoneHash: string,
    age: number,
    emailHash: string
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
  const [loginMethod, setLoginMethod] = useState<"wallet" | "traditional">("traditional");

  // Restore persisted wallet on mount
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.type) {
          if (parsed.loginMethod === "wallet") setLoginMethod("wallet");
          if (parsed.type === "metamask" && window.ethereum) {
            window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
              if (accounts.length > 0) {
                setWalletAddress(accounts[0]);
                setWalletType("metamask");
                localStorage.setItem(
                  WALLET_STORAGE_KEY,
                  JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: parsed.loginMethod || "traditional" })
                );
                window.ethereum.request({ method: "eth_chainId" }).then((id: string) => setChainId(id));
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
            }).catch(() => localStorage.removeItem(WALLET_STORAGE_KEY));
          }
        }
      } catch {
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    } else if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletType("metamask");
          localStorage.setItem(
            WALLET_STORAGE_KEY,
            JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: "traditional" })
          );
          window.ethereum.request({ method: "eth_chainId" }).then((id: string) => setChainId(id));
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
        const saved = localStorage.getItem(WALLET_STORAGE_KEY);
        const method = saved ? (JSON.parse(saved).loginMethod || "traditional") : "traditional";
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: method }));
      }
    };
    const handleChainChanged = (newChainId: string) => setChainId(newChainId);
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [walletType]);

  const connectMetaMask = useCallback(async (isAuthLogin = false): Promise<string | null> => {
    if (!window.ethereum) return null;
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      const network = await provider.getNetwork();
      const method = isAuthLogin ? "wallet" : "traditional";
      setWalletAddress(address);
      setWalletType("metamask");
      setChainId("0x" + network.chainId.toString(16));
      if (isAuthLogin) setLoginMethod("wallet");
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address, type: "metamask", loginMethod: method }));
      return address;
    } catch {
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectPhantom = useCallback(async (isAuthLogin = false): Promise<string | null> => {
    if (!window.solana?.isPhantom) return null;
    setIsConnecting(true);
    try {
      await window.solana.connect();
      const address = window.solana.publicKey?.toString() ?? null;
      if (address) {
        const method = isAuthLogin ? "wallet" : "traditional";
        setWalletAddress(address);
        setWalletType("phantom");
        if (isAuthLogin) setLoginMethod("wallet");
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ address, type: "phantom", loginMethod: method }));
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
    setLoginMethod("traditional");
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  const ALCHEMY_PROXY_URL = `${SUPABASE_URL}/functions/v1/alchemy-proxy?network=eth-sepolia`;

  // Helper to create a provider that routes through our Supabase Edge Function
  const createSecureProvider = () => {
    const fetchReq = new ethers.FetchRequest(ALCHEMY_PROXY_URL);
    if (SUPABASE_ANON_KEY) {
      fetchReq.setHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    }
    return new ethers.JsonRpcProvider(fetchReq, 11155111, { staticNetwork: true });
  };

  const fetchOnChainUserCore = useCallback(
    async (address: string, retryCount = 0): Promise<OnChainUser | null> => {
      const MAX_RETRIES = 3;
      try {
        const attempts: Promise<OnChainUser>[] = [];
        if (window.ethereum) {
          attempts.push(
            (async () => {
              const mmProvider = new ethers.BrowserProvider(window.ethereum);
              const network = await mmProvider.getNetwork();
              if (network.chainId !== 11155111n) throw new Error("Not Sepolia");
              const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, mmProvider);
              const result = await contract.getUser(address);
              return {
                ipfsCid: result[0], name: result[1], profession: result[2],
                phoneHash: result[3], age: Number(result[4]), emailHash: result[5],
                registeredAt: Number(result[6]), exists: result[7],
              };
            })()
          );
        }
        // Attempt via secure proxy
        attempts.push(
          (async () => {
            const provider = createSecureProvider();
            const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, provider);
            const result = await contract.getUser(address);
            return {
              ipfsCid: result[0], name: result[1], profession: result[2],
              phoneHash: result[3], age: Number(result[4]), emailHash: result[5],
              registeredAt: Number(result[6]), exists: result[7],
            };
          })()
        );

        const timeout = new Promise<OnChainUser>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
        const user = await Promise.race([Promise.any(attempts), timeout]);
        
        // Update count non‑blocking
        try {
          const countProvider = createSecureProvider();
          const countContract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, countProvider);
          const count = await countContract.getRegisteredUsersCount();
          setRegisteredUsersCount(Number(count));
        } catch { /* ignore */ }
        return user;
      } catch (e) {
        if (retryCount < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (retryCount + 1) * 2000));
          return fetchOnChainUserCore(address, retryCount + 1);
        }
        return null;
      }
    },
    []
  );

  const fetchOnChainUser = useCallback(async (address?: string): Promise<OnChainUser | null> => {
    const target = address || walletAddress;
    if (!target) return null;
    setLoadingOnChain(true);
    try {
      const user = await fetchOnChainUserCore(target);
      if (!user) return null;
      setOnChainUser((prev) => {
        if (!user.exists && prev?.exists) return prev;
        return user;
      });
      return user;
    } finally {
      setLoadingOnChain(false);
    }
  }, [walletAddress, fetchOnChainUserCore]);

  useEffect(() => {
    if (walletAddress) fetchOnChainUser(walletAddress);
  }, [walletAddress, fetchOnChainUser]);

  const registerUserOnChain = useCallback(
    async (
      ipfsCid: string,
      name: string,
      profession: string,
      phoneHash: string,
      age: number,
      emailHash: string
    ): Promise<string> => {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, signer);
      const tx = await contract.registerUser(ipfsCid, name, profession, phoneHash, age, emailHash);
      const receipt = await tx.wait();
      // Optimistic update
      setOnChainUser({
        ipfsCid, name, profession, phoneHash, age, emailHash,
        registeredAt: Math.floor(Date.now() / 1000), exists: true,
      });
      const signerAddress = await signer.getAddress();
      indexUserRegistration({
        ...extractReceiptFields(receipt),
        contract_address: USER_REGISTRY_ADDRESS,
        wallet_address: signerAddress,
        ipfs_cid: ipfsCid,
        user_name: name,
        profession,
        phone_hash: phoneHash,
        event_type: 'UserRegistered',
        on_chain_timestamp: Math.floor(Date.now() / 1000),
      }).catch(e => console.warn('Indexing failed:', e));
      return receipt.hash;
    },
    []
  );

  const updateUserOnChain = useCallback(
    async (
      ipfsCid: string,
      name: string,
      profession: string,
      phoneHash: string,
      age: number,
      emailHash: string
    ): Promise<string> => {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, signer);
      const tx = await contract.updateProfile(ipfsCid, name, profession, phoneHash, age, emailHash);
      const receipt = await tx.wait();
      setOnChainUser((prev) => prev ? { ...prev, ipfsCid, name, profession, phoneHash, age, emailHash } : null);
      const signerAddress = await signer.getAddress();
      indexUserRegistration({
        ...extractReceiptFields(receipt),
        contract_address: USER_REGISTRY_ADDRESS,
        wallet_address: signerAddress,
        ipfs_cid: ipfsCid,
        user_name: name,
        profession,
        phone_hash: phoneHash,
        event_type: 'ProfileUpdated',
        on_chain_timestamp: Math.floor(Date.now() / 1000),
      }).catch(e => console.warn('Indexing failed:', e));
      return receipt.hash;
    },
    []
  );

  return {
    walletAddress,
    walletType,
    chainId,
    isConnecting,
    onChainUser,
    loadingOnChain,
    registeredUsersCount,
    loginMethod,
    connectMetaMask,
    connectPhantom,
    disconnect,
    fetchOnChainUser,
    registerUserOnChain,
    updateUserOnChain,
  };
}