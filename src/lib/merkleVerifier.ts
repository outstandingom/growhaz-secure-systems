/**
 * merkleVerifier.ts
 *
 * Browser-side implementation of the Merkle verification pipeline:
 *   Content → Clean → Tokenize → Chunk → SHA-256 per chunk → Merkle Tree → Root Hash
 *
 * The Merkle root is a semantic fingerprint. Two differently formatted copies
 * of the same document produce the same root if the text content is identical.
 *
 * Also includes smart-contract read helpers for reverse-lookup:
 *   merkleRoot → { wallet, txHash, contractAddress, IPFS data }
 */

import { ethers } from 'ethers';
import {
  MERKLE_DOCUMENT_REGISTRY_ADDRESS,
  MERKLE_DOCUMENT_REGISTRY_ABI,
} from '@/lib/contractConfig';

// ─── SHA-256 using Web Crypto API ─────────────────────────────────────────────

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Text Cleaning ────────────────────────────────────────────────────────────

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[@©•]/g, '')
    .replace(/[^\w\s:/@.\-]/g, ' ')
    .trim();
}

// ─── Tokenization ─────────────────────────────────────────────────────────────

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

export function createChunks(tokens: string[], chunkSize = 100): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += chunkSize) {
    chunks.push(tokens.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

// ─── Hash Chunks ──────────────────────────────────────────────────────────────

export interface ChunkHash {
  index: number;
  hash: string;
}

export async function hashChunks(chunks: string[]): Promise<ChunkHash[]> {
  const results: ChunkHash[] = [];
  for (let i = 0; i < chunks.length; i++) {
    results.push({ index: i, hash: await sha256(chunks[i]) });
  }
  return results;
}

// ─── Merkle Tree Builder ──────────────────────────────────────────────────────

export interface MerkleTree {
  rootHash: string;
  tree: string[][];        // level 0 = leaves, last level = [root]
  chunkHashes: ChunkHash[];
}

export async function buildMerkleTree(chunkHashes: ChunkHash[]): Promise<MerkleTree | null> {
  if (chunkHashes.length === 0) return null;

  let currentLevel = chunkHashes.map(c => c.hash);
  const tree: string[][] = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // duplicate last if odd
      nextLevel.push(await sha256(left + right));
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  return { rootHash: currentLevel[0], tree, chunkHashes };
}

// ─── Full Pipeline ────────────────────────────────────────────────────────────

export interface MerkleResult {
  cleanedText: string;
  tokens: string[];
  chunks: string[];
  chunkHashes: ChunkHash[];
  merkleRoot: string;
  totalTokens: number;
  totalChunks: number;
  tree: string[][];
}

/**
 * processDocumentForMerkle
 * Takes raw extracted text and produces the full Merkle breakdown.
 * Use this for both Issue (to register on-chain) and Verify (to compare roots).
 */
export async function processDocumentForMerkle(rawText: string): Promise<MerkleResult | null> {
  const cleaned = cleanText(rawText);
  if (cleaned.length < 2) return null;

  const tokens = tokenizeText(cleaned);
  const chunks = createChunks(tokens, 100);
  const hashes = await hashChunks(chunks);
  const tree = await buildMerkleTree(hashes);

  if (!tree) return null;

  return {
    cleanedText: cleaned,
    tokens,
    chunks,
    chunkHashes: hashes,
    merkleRoot: tree.rootHash,
    totalTokens: tokens.length,
    totalChunks: chunks.length,
    tree: tree.tree,
  };
}

// ─── Smart Contract Reverse-Lookup ────────────────────────────────────────────

const SEPOLIA_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sepolia.org',
  'https://sepolia.drpc.org',
];

async function getProvider() {
  // Try MetaMask first
  if ((window as any).ethereum) {
    try {
      const p = new ethers.BrowserProvider((window as any).ethereum);
      const net = await p.getNetwork();
      if (net.chainId === 11155111n) return p;
    } catch { /* fall through */ }
  }
  // Fallback to public RPCs
  for (const rpc of SEPOLIA_RPCS) {
    try {
      return new ethers.JsonRpcProvider(rpc, 11155111, { staticNetwork: true });
    } catch { continue; }
  }
  throw new Error('No Sepolia provider available');
}

export interface OnChainMerkleDocument {
  merkleRoot: string;
  fileHash: string;
  contentHash: string;
  ipfsCid: string;
  metadataCid: string;
  totalChunks: number;
  totalTokens: number;
  issuer: string;       // wallet address
  timestamp: number;
  docType: string;
  documentName: string;
  exists: boolean;
}

/**
 * lookupByMerkleRoot
 * Given a Merkle root, fetch the full document record from the smart contract.
 * Returns issuer wallet, IPFS CIDs, file hash, etc.
 */
export async function lookupByMerkleRoot(merkleRoot: string): Promise<OnChainMerkleDocument | null> {
  try {
    const provider = await getProvider();
    const contract = new ethers.Contract(
      MERKLE_DOCUMENT_REGISTRY_ADDRESS,
      MERKLE_DOCUMENT_REGISTRY_ABI,
      provider
    );
    const result = await contract.getDocumentByMerkle(merkleRoot);
    if (!result[10]) return null; // exists = false
    return {
      merkleRoot,
      fileHash: result[0],
      contentHash: result[1],
      ipfsCid: result[2],
      metadataCid: result[3],
      totalChunks: Number(result[4]),
      totalTokens: Number(result[5]),
      issuer: result[6],
      timestamp: Number(result[7]),
      docType: result[8],
      documentName: result[9],
      exists: result[10],
    };
  } catch (e) {
    console.error('[merkleVerifier] lookupByMerkleRoot failed:', e);
    return null;
  }
}

/**
 * lookupByFileHash
 * Given a file SHA-256 hash, find the Merkle root, then fetch the full record.
 */
export async function lookupByFileHash(fileHash: string): Promise<OnChainMerkleDocument | null> {
  try {
    const provider = await getProvider();
    const contract = new ethers.Contract(
      MERKLE_DOCUMENT_REGISTRY_ADDRESS,
      MERKLE_DOCUMENT_REGISTRY_ABI,
      provider
    );
    const merkleRoot: string = await contract.lookupByFileHash(fileHash);
    if (!merkleRoot || merkleRoot === '') return null;
    return lookupByMerkleRoot(merkleRoot);
  } catch (e) {
    console.error('[merkleVerifier] lookupByFileHash failed:', e);
    return null;
  }
}

/**
 * lookupByContentHash
 * Given a content SHA-256 hash, find the Merkle root, then fetch the full record.
 */
export async function lookupByContentHash(contentHash: string): Promise<OnChainMerkleDocument | null> {
  try {
    const provider = await getProvider();
    const contract = new ethers.Contract(
      MERKLE_DOCUMENT_REGISTRY_ADDRESS,
      MERKLE_DOCUMENT_REGISTRY_ABI,
      provider
    );
    const merkleRoot: string = await contract.lookupByContentHash(contentHash);
    if (!merkleRoot || merkleRoot === '') return null;
    return lookupByMerkleRoot(merkleRoot);
  } catch (e) {
    console.error('[merkleVerifier] lookupByContentHash failed:', e);
    return null;
  }
}

/**
 * registerDocumentOnChain
 * Registers a document's Merkle root and metadata on the smart contract via MetaMask.
 * Returns the transaction receipt.
 */
export async function registerDocumentOnChain(params: {
  merkleRoot: string;
  fileHash: string;
  contentHash: string;
  ipfsCid: string;
  metadataCid: string;
  totalChunks: number;
  totalTokens: number;
  docType: string;
  documentName: string;
}) {
  if (!(window as any).ethereum) throw new Error('MetaMask not installed');

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(
    MERKLE_DOCUMENT_REGISTRY_ADDRESS,
    MERKLE_DOCUMENT_REGISTRY_ABI,
    signer
  );

  const tx = await contract.registerDocument(
    params.merkleRoot,
    params.fileHash,
    params.contentHash,
    params.ipfsCid,
    params.metadataCid,
    params.totalChunks,
    params.totalTokens,
    params.docType,
    params.documentName
  );

  console.log('[merkleVerifier] TX sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('[merkleVerifier] TX mined ✓ block:', receipt.blockNumber);

  return receipt;
}
