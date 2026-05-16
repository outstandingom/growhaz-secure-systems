/**
 * useWeb3Wallet — Detects and manages MetaMask/Phantom wallet connection.
 * Provides wallet address, chain info, connection helpers, and on-chain
 * UserRegistry interactions (register/fetch/update user profile).
 *
 * KEY BEHAVIOR:
 * - If the user logged in via MetaMask/Phantom (Web3Login), the wallet is
 *   auto-detected and on-chain data is fetched immediately.
 * - If the user logged in via password/Google, no wallet is connected by
 *   default. The user can optionally connect a wallet later.
 * - `loginMethod` distinguishes between "wallet" (logged in via Web3) and
 *   "traditional" (password/Google). This drives UI decisions in Profile.tsx.
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
  /** "wallet" if user auth'd via MetaMask/Phantom, "traditional" otherwise */
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
  const [loginMethod, setLoginMethod] = useState<"wallet" | "traditional">("traditional");

  // Restore persisted wallet on mount, or detect already-authorized MetaMask
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.address && parsed.type) {
          // Determine login method from stored data
          if (parsed.loginMethod === "wallet") {
            setLoginMethod("wallet");
          }

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
                    JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: parsed.loginMethod || "traditional" })
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
              JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: "traditional" })
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
        const saved = localStorage.getItem(WALLET_STORAGE_KEY);
        const method = saved ? (JSON.parse(saved).loginMethod || "traditional") : "traditional";
        localStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({ address: accounts[0], type: "metamask", loginMethod: method })
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


  /**
   * connectMetaMask — Connect wallet via MetaMask.
   * @param isAuthLogin — true when called from Auth/Web3Login (primary auth method)
   */
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
      localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ address, type: "metamask", loginMethod: method })
      );
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
        localStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({ address, type: "phantom", loginMethod: method })
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
    setLoginMethod("traditional");
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  // ─── Sepolia RPC endpoints ───
  const SEPOLIA_RPCS = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.drpc.org",
    "https://rpc2.sepolia.org",
    "https://eth-sepolia.public.blastapi.io",
    "https://endpoints.omniatech.io/v1/eth/sepolia/public",
    "https://1rpc.io/sepolia",
  ];

  /**
   * Directly fetch user from smart contract — tries MetaMask first, then races
   * all public RPCs. Skips the getBlockNumber() connectivity check (some RPCs
   * block it) and instead goes straight for getUser() which is a view call.
   * Includes retry logic with backoff.
   */
  const fetchOnChainUserCore = useCallback(
    async (address: string, retryCount = 0): Promise<OnChainUser | null> => {
      const MAX_RETRIES = 3;
      console.log(`[fetchOnChainUser] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} for ${address.slice(0, 8)}...`);

      try {
        // Strategy: try ALL providers and race — first successful getUser() wins

        // 1) Build provider list — MetaMask first (if on Sepolia), then public RPCs
        const attempts: Promise<OnChainUser>[] = [];

        // MetaMask attempt
        if (window.ethereum) {
          attempts.push(
            (async () => {
              const mmProvider = new ethers.BrowserProvider(window.ethereum);
              const network = await mmProvider.getNetwork();
              if (network.chainId !== 11155111n) throw new Error("Not Sepolia");
              const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, mmProvider);
              const result = await contract.getUser(address);
              console.log("[fetchOnChainUser] ✓ MetaMask provider succeeded");
              return {
                ipfsCid: result[0], name: result[1], profession: result[2],
                phoneHash: result[3], registeredAt: Number(result[4]), exists: result[5],
              };
            })()
          );
        }

        // Public RPC attempts — each directly calls getUser() (no getBlockNumber check)
        for (const rpc of SEPOLIA_RPCS) {
          attempts.push(
            (async () => {
              const provider = new ethers.JsonRpcProvider(rpc, 11155111, { staticNetwork: true });
              const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, provider);
              const result = await contract.getUser(address);
              console.log("[fetchOnChainUser] ✓ Public RPC succeeded:", rpc);
              return {
                ipfsCid: result[0], name: result[1], profession: result[2],
                phoneHash: result[3], registeredAt: Number(result[4]), exists: result[5],
              };
            })()
          );
        }

        // Race with a 10-second global timeout
        const timeout = new Promise<OnChainUser>((_, reject) =>
          setTimeout(() => reject(new Error("All providers timed out (10s)")), 10000)
        );

        const user = await Promise.race([
          Promise.any(attempts),
          timeout,
        ]);

        console.log("[fetchOnChainUser] On-chain user:", user);

        // Also try to get registered users count (non-blocking)
        try {
          const countProvider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[0], 11155111, { staticNetwork: true });
          const countContract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, countProvider);
          const count = await countContract.getRegisteredUsersCount();
          setRegisteredUsersCount(Number(count));
        } catch { /* ignore count errors */ }

        return user;
      } catch (e) {
        console.error(`[fetchOnChainUser] Attempt ${retryCount + 1} failed:`, e);

        // Retry with backoff
        if (retryCount < MAX_RETRIES) {
          const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
          console.log(`[fetchOnChainUser] Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          return fetchOnChainUserCore(address, retryCount + 1);
        }

        console.error("[fetchOnChainUser] All retries exhausted");
        return null;
      }
    },
    []
  );

  // ─── Public-facing fetchOnChainUser with stale-data guard ───
  const fetchOnChainUser = useCallback(
    async (address?: string): Promise<OnChainUser | null> => {
      const target = address || walletAddress;
      if (!target) return null;

      setLoadingOnChain(true);
      try {
        const user = await fetchOnChainUserCore(target);

        if (!user) {
          // Fetch failed — don't null out if we already have a confirmed user
          return null;
        }

        // ─── STALE-DATA GUARD ───
        // Never downgrade from exists:true → exists:false.
        // Public RPCs can lag behind MetaMask by several blocks.
        // We check the CURRENT state ref, not a stale closure.
        setOnChainUser((prev) => {
          if (!user.exists && prev?.exists) {
            console.warn("[fetchOnChainUser] Ignoring stale RPC data (exists:false) — preserved existing state");
            return prev;
          }
          return user;
        });

        return user;
      } finally {
        setLoadingOnChain(false);
      }
    },
    [walletAddress, fetchOnChainUserCore]
  );

  // Auto-fetch on-chain user when wallet connects
  useEffect(() => {
    if (walletAddress) {
      console.log("[useWeb3Wallet] Wallet detected, fetching on-chain profile for:", walletAddress);
      fetchOnChainUser(walletAddress);
    }
  }, [walletAddress, fetchOnChainUser]);


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
      console.log("[registerUserOnChain] TX sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("[registerUserOnChain] TX mined ✓ block:", receipt.blockNumber);

      // ─── OPTIMISTIC UPDATE ───
      // tx.wait() succeeded = data IS on-chain. Set the state immediately
      // from the params we already know. No need to wait for a read-back.
      const optimisticUser: OnChainUser = {
        ipfsCid,
        name,
        profession,
        phoneHash,
        registeredAt: Math.floor(Date.now() / 1000),
        exists: true,
      };
      setOnChainUser(optimisticUser);
      console.log("[registerUserOnChain] Optimistic state set:", optimisticUser);

      // ─── INDEX ON SUPABASE (non-blocking) ───
      // Blockchain data can't be searched — write an index row so the app
      // can instantly look up this user by wallet_address or tx hash.
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
      }).catch(e => console.warn('[registerUserOnChain] Indexing failed (non-critical):', e));

      // Background: update user count only (don't re-fetch user — optimistic state is correct)
      try {
        const readContract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, provider);
        const count = await readContract.getRegisteredUsersCount();
        setRegisteredUsersCount(Number(count));
      } catch { /* ignore */ }

      return receipt.hash;
    },
    []
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
      console.log("[updateUserOnChain] TX sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("[updateUserOnChain] TX mined ✓ block:", receipt.blockNumber);

      // ─── OPTIMISTIC UPDATE ───
      const optimisticUser: OnChainUser = {
        ipfsCid,
        name,
        profession,
        phoneHash,
        registeredAt: onChainUser?.registeredAt || Math.floor(Date.now() / 1000),
        exists: true,
      };
      setOnChainUser(optimisticUser);
      console.log("[updateUserOnChain] Optimistic state set:", optimisticUser);

      // ─── INDEX ON SUPABASE (non-blocking) ───
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
      }).catch(e => console.warn('[updateUserOnChain] Indexing failed (non-critical):', e));

      return receipt.hash;
    },
    [onChainUser]
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
