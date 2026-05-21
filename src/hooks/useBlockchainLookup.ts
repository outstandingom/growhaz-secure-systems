/**
 * useBlockchainLookup
 * Extracts data from smart contracts + IPFS by querying the
 * Supabase index first (fast), then fetching live from chain/IPFS.
 *
 * Supports lookup by:
 *   - Transaction hash  (0x... 66 chars)
 *   - Wallet address    (0x... 42 chars)
 *   - File/content hash (64-char hex, no 0x)
 *   - Document ID       (any other string)
 */
import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import {
  USER_REGISTRY_ADDRESS,
  USER_REGISTRY_ABI,
  DOCUMENT_REGISTRY_V2_ADDRESS,
  DOCUMENT_REGISTRY_V2_ABI,
} from "@/lib/contractConfig";

export type LookupInputType = "tx_hash" | "wallet" | "file_hash" | "doc_id" | "unknown";

export interface LookupResult {
  inputType: LookupInputType;
  // From Supabase index
  userRegistrations: any[];
  documentRegistrations: any[];
  accessGrants: any[];
  // Live from smart contract
  contractUserData: {
    ipfsCid: string;
    name: string;
    profession: string;
    phoneHash: string;
    registeredAt: number;
    exists: boolean;
    walletAddress: string;
  } | null;
  contractDocData: {
    docId: string;
    merkleRoot: string;
    fileHash: string;
    contentIpfsCid: string;
    metadataIpfsCid: string;
    totalChunks: number;
    issuer: string;
    timestamp: number;
    docType: string;
  } | null;
  // From IPFS
  ipfsProfileData: Record<string, any> | null;
  ipfsDocumentData: Record<string, any> | null;
  error: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const ALCHEMY_PROXY_URL = `${SUPABASE_URL}/functions/v1/alchemy-proxy?network=eth-sepolia`;

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

function detectInputType(q: string): LookupInputType {
  const trimmed = q.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return "tx_hash";
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return "wallet";
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return "file_hash";
  if (trimmed.length > 0) return "doc_id";
  return "unknown";
}

async function getRpcProvider() {
  try {
    const fetchReq = new ethers.FetchRequest(ALCHEMY_PROXY_URL);
    if (SUPABASE_ANON_KEY) {
      fetchReq.setHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    }
    return new ethers.JsonRpcProvider(fetchReq, 11155111, { staticNetwork: true });
  } catch {
    return null;
  }
}

async function fetchFromIpfs(cid: string): Promise<Record<string, any> | null> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gw}${cid}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { raw: text }; }
      }
    } catch { continue; }
  }
  return null;
}

async function fetchContractUser(wallet: string) {
  try {
    const provider = await getRpcProvider();
    if (!provider) return null;
    const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, USER_REGISTRY_ABI, provider);
    const result = await contract.getUser(wallet);
    return {
      walletAddress: wallet,
      ipfsCid: result[0],
      name: result[1],
      profession: result[2],
      phoneHash: result[3],
      registeredAt: Number(result[4]),
      exists: result[5],
    };
  } catch { return null; }
}

async function fetchContractDoc(docId: string) {
  try {
    const provider = await getRpcProvider();
    if (!provider) return null;
    const contract = new ethers.Contract(DOCUMENT_REGISTRY_V2_ADDRESS, DOCUMENT_REGISTRY_V2_ABI, provider);
    const result = await contract.getDocument(docId);
    return {
      docId,
      merkleRoot: result[0],
      fileHash: result[1],
      contentIpfsCid: result[2],
      metadataIpfsCid: result[3],
      totalChunks: Number(result[4]),
      issuer: result[5],
      timestamp: Number(result[6]),
      docType: result[7],
    };
  } catch { return null; }
}

export function useBlockchainLookup() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookup = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setResult(null);

    const inputType = detectInputType(q);
    const out: LookupResult = {
      inputType,
      userRegistrations: [],
      documentRegistrations: [],
      accessGrants: [],
      contractUserData: null,
      contractDocData: null,
      ipfsProfileData: null,
      ipfsDocumentData: null,
      error: null,
    };

    try {
      // ── 1. Query Supabase index ──────────────────────────────────────────
      if (inputType === "tx_hash") {
        const [ur, dr, ag] = await Promise.all([
          supabase.from("blockchain_user_registrations").select("*").eq("transaction_hash", q),
          supabase.from("blockchain_document_registry").select("*").eq("transaction_hash", q),
          supabase.from("blockchain_access_grants").select("*").eq("transaction_hash", q),
        ]);
        out.userRegistrations = ur.data ?? [];
        out.documentRegistrations = dr.data ?? [];
        out.accessGrants = ag.data ?? [];
      } else if (inputType === "wallet") {
        const [ur, dr, agOwner, agViewer] = await Promise.all([
          supabase.from("blockchain_user_registrations").select("*").eq("wallet_address", q.toLowerCase()).order("block_number", { ascending: false }),
          supabase.from("blockchain_document_registry").select("*").eq("wallet_address", q.toLowerCase()).order("block_number", { ascending: false }),
          supabase.from("blockchain_access_grants").select("*").eq("owner_wallet", q.toLowerCase()),
          supabase.from("blockchain_access_grants").select("*").eq("viewer_wallet", q.toLowerCase()),
        ]);
        out.userRegistrations = ur.data ?? [];
        out.documentRegistrations = dr.data ?? [];
        out.accessGrants = [...(agOwner.data ?? []), ...(agViewer.data ?? [])];
      } else if (inputType === "file_hash") {
        const { data } = await supabase.from("blockchain_document_registry").select("*").eq("file_hash", q).order("block_number", { ascending: false });
        out.documentRegistrations = data ?? [];
        // Also check verified_documents
        const { data: vd } = await supabase.from("verified_documents").select("*").eq("file_hash", q).limit(5);
        if (vd && vd.length > 0) out.documentRegistrations = [...out.documentRegistrations, ...vd];
      } else {
        // doc_id — search by document_id in registry
        const { data } = await supabase.from("blockchain_document_registry").select("*").eq("document_id", q);
        out.documentRegistrations = data ?? [];
      }

      // ── 2. Live contract read ────────────────────────────────────────────
      if (inputType === "wallet") {
        out.contractUserData = await fetchContractUser(q);
      }

      // For tx_hash or doc_id, try to get the wallet from index then read contract
      if (inputType === "tx_hash" || inputType === "doc_id") {
        const wallet = out.userRegistrations[0]?.wallet_address;
        if (wallet) out.contractUserData = await fetchContractUser(wallet);

        const docId = out.documentRegistrations[0]?.document_id;
        if (docId) out.contractDocData = await fetchContractDoc(docId);
      }

      if (inputType === "file_hash") {
        const docId = out.documentRegistrations[0]?.document_id;
        if (docId) out.contractDocData = await fetchContractDoc(docId);
      }

      // ── 3. IPFS fetch ────────────────────────────────────────────────────
      const profileCid = out.contractUserData?.ipfsCid || out.userRegistrations[0]?.ipfs_cid;
      if (profileCid) {
        out.ipfsProfileData = await fetchFromIpfs(profileCid);
      }

      const docCid = out.contractDocData?.contentIpfsCid || out.documentRegistrations[0]?.ipfs_cid;
      if (docCid) {
        out.ipfsDocumentData = await fetchFromIpfs(docCid);
      }

    } catch (e: any) {
      out.error = e.message || "Lookup failed";
    }

    setResult(out);
    setLoading(false);
  }, []);

  return { lookup, loading, result, clear: () => setResult(null) };
}
