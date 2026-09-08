/**
 * Isolated Arbitrum provenance hook — used ONLY by the Document Verification
 * blockchain provenance module. It reuses the browser wallet already used by
 * the rest of the app (window.ethereum / MetaMask) but targets Arbitrum.
 */
import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  PROVENANCE_NETWORK,
  PROVENANCE_REGISTRY_ABI,
  PROVENANCE_REGISTRY_ADDRESS,
  EVENT_TYPES,
  STATES,
  type ProvenanceEventType,
  type ProvenanceState,
} from "@/lib/provenanceConfig";

export interface ChainVersion {
  version: number;
  previousVersion: number;
  fileHash: string;
  contentHash: string;
  merkleRoot: string;
  semanticHash: string;
  metadataURI: string;
  actor: string;
  eventType: ProvenanceEventType;
  state: ProvenanceState;
  supersededBy: number;
  timestamp: number;
}

export interface ChainAttestation {
  actor: string;
  role: string;
  statementHash: string;
  timestamp: number;
}

/** Deterministic hash of any JSON structure (used for the semantic/KG hash). */
export async function deterministicHash(value: unknown): Promise<string> {
  const canonical = (v: any): any => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.keys(v)
        .sort()
        .reduce((acc: Record<string, any>, k) => {
          acc[k] = canonical(v[k]);
          return acc;
        }, {});
    }
    return v;
  };
  const text = JSON.stringify(canonical(value ?? null));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mapVersion(v: any): ChainVersion {
  return {
    version: Number(v.version ?? v[0]),
    previousVersion: Number(v.previousVersion ?? v[1]),
    fileHash: v.fileHash ?? v[2],
    contentHash: v.contentHash ?? v[3],
    merkleRoot: v.merkleRoot ?? v[4],
    semanticHash: v.semanticHash ?? v[5],
    metadataURI: v.metadataURI ?? v[6],
    actor: v.actor ?? v[7],
    eventType: EVENT_TYPES[Number(v.eventType ?? v[8])] ?? "REGISTERED",
    state: STATES[Number(v.state ?? v[9])] ?? "ACTIVE",
    supersededBy: Number(v.supersededBy ?? v[10]),
    timestamp: Number(v.timestamp ?? v[11]),
  };
}

export function useProvenance() {
  const [busy, setBusy] = useState(false);

  const configured = !!PROVENANCE_REGISTRY_ADDRESS;

  const readProvider = useMemo(
    () =>
      new ethers.JsonRpcProvider(PROVENANCE_NETWORK.rpcUrls[0], PROVENANCE_NETWORK.chainId, {
        staticNetwork: true,
      }),
    []
  );

  const ensureNetwork = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("No wallet detected. Install MetaMask to sign blockchain actions.");
    const current = await eth.request({ method: "eth_chainId" });
    if (current !== PROVENANCE_NETWORK.chainHex) {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: PROVENANCE_NETWORK.chainHex }],
        });
      } catch (e: any) {
        if (e?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: PROVENANCE_NETWORK.chainHex,
                chainName: PROVENANCE_NETWORK.name,
                nativeCurrency: { name: "Ether", symbol: PROVENANCE_NETWORK.symbol, decimals: 18 },
                rpcUrls: PROVENANCE_NETWORK.rpcUrls,
                blockExplorerUrls: [PROVENANCE_NETWORK.explorer],
              },
            ],
          });
        } else throw e;
      }
    }
  }, []);

  const connect = useCallback(async (): Promise<string> => {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("No wallet detected. Install MetaMask to sign blockchain actions.");
    const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
    await ensureNetwork();
    return accounts[0];
  }, [ensureNetwork]);

  const getContract = useCallback(
    async (write = false) => {
      if (!configured)
        throw new Error(
          "Provenance registry address is not configured. Deploy ProvenanceRegistry and set VITE_PROVENANCE_REGISTRY_ADDRESS."
        );
      if (!write) {
        return new ethers.Contract(PROVENANCE_REGISTRY_ADDRESS, PROVENANCE_REGISTRY_ABI, readProvider);
      }
      await connect();
      const signer = await new ethers.BrowserProvider((window as any).ethereum).getSigner();
      return new ethers.Contract(PROVENANCE_REGISTRY_ADDRESS, PROVENANCE_REGISTRY_ABI, signer);
    },
    [configured, connect, readProvider]
  );

  // ── Reads ──────────────────────────────────────────────────────────────
  const getRecord = useCallback(
    async (recordId: string) => {
      const c = await getContract(false);
      const [issuer, currentVersion, createdAt, exists] = await c.getRecord(recordId);
      return {
        issuer: issuer as string,
        currentVersion: Number(currentVersion),
        createdAt: Number(createdAt),
        exists: Boolean(exists),
      };
    },
    [getContract]
  );

  const getVersionHistory = useCallback(
    async (recordId: string): Promise<ChainVersion[]> => {
      const c = await getContract(false);
      const rows = await c.getVersionHistory(recordId);
      return (rows as any[]).map(mapVersion);
    },
    [getContract]
  );

  const getAttestations = useCallback(
    async (recordId: string, version: number): Promise<ChainAttestation[]> => {
      const c = await getContract(false);
      const rows = await c.getAttestations(recordId, version);
      return (rows as any[]).map((a) => ({
        actor: a.actor ?? a[0],
        role: a.role ?? a[1],
        statementHash: a.statementHash ?? a[2],
        timestamp: Number(a.timestamp ?? a[3]),
      }));
    },
    [getContract]
  );

  // ── Writes (all wallet-confirmed) ──────────────────────────────────────
  const send = useCallback(
    async (fn: (c: ethers.Contract) => Promise<any>) => {
      setBusy(true);
      try {
        const c = await getContract(true);
        const tx = await fn(c);
        const receipt = await tx.wait();
        return {
          txHash: tx.hash as string,
          blockHash: (receipt?.blockHash as string) ?? null,
          blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : null,
        };
      } catch (e: any) {
        if (e?.code === "ACTION_REJECTED" || e?.code === 4001) {
          throw new Error("Transaction rejected by wallet.");
        }
        throw new Error(e?.shortMessage || e?.message || "Blockchain transaction failed.");
      } finally {
        setBusy(false);
      }
    },
    [getContract]
  );

  const registerRecord = useCallback(
    (p: {
      recordId: string;
      fileHash: string;
      contentHash: string;
      merkleRoot: string;
      semanticHash: string;
      metadataURI: string;
    }) =>
      send((c) =>
        c.registerRecord(p.recordId, p.fileHash, p.contentHash, p.merkleRoot, p.semanticHash, p.metadataURI)
      ),
    [send]
  );

  const addVersion = useCallback(
    (p: {
      recordId: string;
      fileHash: string;
      contentHash: string;
      merkleRoot: string;
      semanticHash: string;
      metadataURI: string;
      eventType: ProvenanceEventType;
    }) =>
      send((c) =>
        c.addVersion(
          p.recordId,
          p.fileHash,
          p.contentHash,
          p.merkleRoot,
          p.semanticHash,
          p.metadataURI,
          EVENT_TYPES.indexOf(p.eventType)
        )
      ),
    [send]
  );

  const attestVersion = useCallback(
    (p: { recordId: string; version: number; role: string; statementHash: string }) =>
      send((c) => c.attestVersion(p.recordId, p.version, p.role, p.statementHash)),
    [send]
  );

  const revokeVersion = useCallback(
    (p: { recordId: string; version: number; reasonHash: string }) =>
      send((c) => c.revokeVersion(p.recordId, p.version, p.reasonHash)),
    [send]
  );

  const supersedeVersion = useCallback(
    (p: { recordId: string; oldVersion: number; newVersion: number }) =>
      send((c) => c.supersedeVersion(p.recordId, p.oldVersion, p.newVersion)),
    [send]
  );

  return {
    busy,
    configured,
    network: PROVENANCE_NETWORK,
    registryAddress: PROVENANCE_REGISTRY_ADDRESS,
    connect,
    ensureNetwork,
    getRecord,
    getVersionHistory,
    getAttestations,
    registerRecord,
    addVersion,
    attestVersion,
    revokeVersion,
    supersedeVersion,
  };
}
