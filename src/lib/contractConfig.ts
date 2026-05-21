/**
 * Smart Contract Configuration — Centralized addresses & ABIs for all deployed contracts.
 * Network: Ethereum Sepolia Testnet
 */

// ═══════════════════════════════════════════════════════════════════
// 1) DocumentRegistry (V1) — Simple hash-based document verification
// ═══════════════════════════════════════════════════════════════════
export const DOCUMENT_REGISTRY_ADDRESS = "0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47";
export const DOCUMENT_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "documentId", type: "string" },
      { indexed: false, internalType: "string", name: "documentHash", type: "string" },
      { indexed: false, internalType: "string", name: "ownerId", type: "string" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
      { indexed: false, internalType: "address", name: "verifier", type: "address" },
    ],
    name: "DocumentVerified",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_documentId", type: "string" },
      { internalType: "string", name: "_documentHash", type: "string" },
      { internalType: "string", name: "_ownerId", type: "string" },
    ],
    name: "verifyDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "documents",
    outputs: [
      { internalType: "string", name: "documentId", type: "string" },
      { internalType: "string", name: "documentHash", type: "string" },
      { internalType: "string", name: "ownerId", type: "string" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "address", name: "verifier", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_documentHash", type: "string" }],
    name: "getDocumentDetails",
    outputs: [
      { internalType: "string", name: "documentId", type: "string" },
      { internalType: "string", name: "ownerId", type: "string" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "address", name: "verifier", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalDocuments",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_documentHash", type: "string" }],
    name: "isDocumentVerified",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "verifiedDocumentHashes",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

// ═══════════════════════════════════════════════════════════════════
// 2) DocumentRegistryV2 — Merkle-tree based document verification
// ═══════════════════════════════════════════════════════════════════
export const DOCUMENT_REGISTRY_V2_ADDRESS = "0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3";
export const DOCUMENT_REGISTRY_V2_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "docId", type: "string" },
      { indexed: false, internalType: "string", name: "merkleRoot", type: "string" },
      { indexed: true, internalType: "address", name: "issuer", type: "address" },
    ],
    name: "DocumentRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "docId", type: "string" },
      { indexed: false, internalType: "bool", name: "isAuthentic", type: "bool" },
      { indexed: true, internalType: "address", name: "verifier", type: "address" },
    ],
    name: "DocumentVerified",
    type: "event",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "documents",
    outputs: [
      { internalType: "string", name: "merkleRoot", type: "string" },
      { internalType: "string", name: "fileHash", type: "string" },
      { internalType: "string", name: "contentIpfsCid", type: "string" },
      { internalType: "string", name: "metadataIpfsCid", type: "string" },
      { internalType: "uint256", name: "totalChunks", type: "uint256" },
      { internalType: "address", name: "issuer", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "string", name: "docType", type: "string" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_docId", type: "string" }],
    name: "getDocument",
    outputs: [
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "string", name: "", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_issuer", type: "address" }],
    name: "getIssuerDocuments",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "issuerDocuments",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "string", name: "_merkleRoot", type: "string" },
      { internalType: "string", name: "_fileHash", type: "string" },
      { internalType: "string", name: "_contentIpfsCid", type: "string" },
      { internalType: "string", name: "_metadataIpfsCid", type: "string" },
      { internalType: "uint256", name: "_totalChunks", type: "uint256" },
      { internalType: "string", name: "_docType", type: "string" },
    ],
    name: "registerDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "string", name: "_merkleRoot", type: "string" },
    ],
    name: "verifyMerkleRoot",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ═══════════════════════════════════════════════════════════════════
// 3) UserRegistry — On-chain user profiles with IPFS CID storage
// ═══════════════════════════════════════════════════════════════════
export const USER_REGISTRY_ADDRESS = "0xDA0bab807633f07f013f94DD0E6A4F96F8742B53";
export const USER_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "wallet", type: "address" },
      { indexed: false, internalType: "string", name: "ipfsCid", type: "string" },
    ],
    name: "ProfileUpdated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_ipfsCid", type: "string" },
      { internalType: "string", name: "_name", type: "string" },
      { internalType: "string", name: "_profession", type: "string" },
      { internalType: "string", name: "_phoneHash", type: "string" },
      { internalType: "uint256", name: "_age", type: "uint256" },
      { internalType: "string", name: "_emailHash", type: "string" },
    ],
    name: "registerUser",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_ipfsCid", type: "string" },
      { internalType: "string", name: "_name", type: "string" },
      { internalType: "string", name: "_profession", type: "string" },
      { internalType: "string", name: "_phoneHash", type: "string" },
      { internalType: "uint256", name: "_age", type: "uint256" },
      { internalType: "string", name: "_emailHash", type: "string" },
    ],
    name: "updateProfile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "wallet", type: "address" },
      { indexed: false, internalType: "string", name: "ipfsCid", type: "string" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
      { indexed: false, internalType: "uint256", name: "age", type: "uint256" },
    ],
    name: "UserRegistered",
    type: "event",
  },
  {
    inputs: [],
    name: "getRegisteredUsersCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_wallet", type: "address" }],
    name: "getUser",
    outputs: [
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bool", name: "", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "userCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "users",
    outputs: [
      { internalType: "string", name: "ipfsCid", type: "string" },
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "profession", type: "string" },
      { internalType: "string", name: "phoneHash", type: "string" },
      { internalType: "uint256", name: "age", type: "uint256" },
      { internalType: "string", name: "emailHash", type: "string" },
      { internalType: "uint256", name: "registeredAt", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ═══════════════════════════════════════════════════════════════════
// 4) DocumentAccessControl — On-chain permission management
// ═══════════════════════════════════════════════════════════════════
export const DOCUMENT_ACCESS_CONTROL_ADDRESS = "0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B";
export const DOCUMENT_ACCESS_CONTROL_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "docId", type: "string" },
      { indexed: true, internalType: "address", name: "viewer", type: "address" },
      { indexed: false, internalType: "uint256", name: "expiresAt", type: "uint256" },
    ],
    name: "AccessGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "docId", type: "string" },
      { indexed: true, internalType: "address", name: "viewer", type: "address" },
    ],
    name: "AccessRevoked",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "address", name: "_viewer", type: "address" },
      { internalType: "uint256", name: "_expiresAt", type: "uint256" },
    ],
    name: "grantAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "address", name: "_viewer", type: "address" },
    ],
    name: "revokeAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "address", name: "_viewer", type: "address" },
      { internalType: "address", name: "_owner", type: "address" },
    ],
    name: "hasAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_docId", type: "string" }],
    name: "getDocumentViewers",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "accessGrants",
    outputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "grantedAt", type: "uint256" },
      { internalType: "uint256", name: "expiresAt", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "", type: "string" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "documentViewers",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// ═══════════════════════════════════════════════════════════════════
// 5) MerkleDocumentRegistry — Content-based Merkle root verification
//    Deploy via Remix IDE, then paste the address below.
// ═══════════════════════════════════════════════════════════════════
export const MERKLE_DOCUMENT_REGISTRY_ADDRESS = "0xddaAd340b0f1Ef65169Ae5E41A8b10776a75482d";
export const MERKLE_DOCUMENT_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "merkleRoot", type: "string" },
      { indexed: false, internalType: "string", name: "fileHash", type: "string" },
      { indexed: false, internalType: "string", name: "contentHash", type: "string" },
      { indexed: false, internalType: "string", name: "ipfsCid", type: "string" },
      { indexed: false, internalType: "uint256", name: "totalChunks", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalTokens", type: "uint256" },
      { indexed: true, internalType: "address", name: "issuer", type: "address" },
      { indexed: false, internalType: "string", name: "docType", type: "string" },
      { indexed: false, internalType: "string", name: "documentName", type: "string" },
    ],
    name: "DocumentRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "merkleRoot", type: "string" },
      { indexed: false, internalType: "bool", name: "isAuthentic", type: "bool" },
      { indexed: true, internalType: "address", name: "verifier", type: "address" },
    ],
    name: "DocumentVerified",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_merkleRoot", type: "string" },
      { internalType: "string", name: "_fileHash", type: "string" },
      { internalType: "string", name: "_contentHash", type: "string" },
      { internalType: "string", name: "_ipfsCid", type: "string" },
      { internalType: "string", name: "_metadataCid", type: "string" },
      { internalType: "uint256", name: "_totalChunks", type: "uint256" },
      { internalType: "uint256", name: "_totalTokens", type: "uint256" },
      { internalType: "string", name: "_docType", type: "string" },
      { internalType: "string", name: "_documentName", type: "string" },
    ],
    name: "registerDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_merkleRoot", type: "string" }],
    name: "getDocumentByMerkle",
    outputs: [
      { internalType: "string", name: "fileHash", type: "string" },
      { internalType: "string", name: "contentHash", type: "string" },
      { internalType: "string", name: "ipfsCid", type: "string" },
      { internalType: "string", name: "metadataCid", type: "string" },
      { internalType: "uint256", name: "totalChunks", type: "uint256" },
      { internalType: "uint256", name: "totalTokens", type: "uint256" },
      { internalType: "address", name: "issuer", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "string", name: "docType", type: "string" },
      { internalType: "string", name: "documentName", type: "string" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_merkleRoot", type: "string" }],
    name: "verifyMerkleRoot",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_fileHash", type: "string" }],
    name: "lookupByFileHash",
    outputs: [{ internalType: "string", name: "merkleRoot", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "_contentHash", type: "string" }],
    name: "lookupByContentHash",
    outputs: [{ internalType: "string", name: "merkleRoot", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_issuer", type: "address" }],
    name: "getIssuerDocuments",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalDocuments",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "documentsByMerkle",
    outputs: [
      { internalType: "string", name: "merkleRoot", type: "string" },
      { internalType: "string", name: "fileHash", type: "string" },
      { internalType: "string", name: "contentHash", type: "string" },
      { internalType: "string", name: "ipfsCid", type: "string" },
      { internalType: "string", name: "metadataCid", type: "string" },
      { internalType: "uint256", name: "totalChunks", type: "uint256" },
      { internalType: "uint256", name: "totalTokens", type: "uint256" },
      { internalType: "address", name: "issuer", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "string", name: "docType", type: "string" },
      { internalType: "string", name: "documentName", type: "string" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "merkleByFileHash",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "merkleByContentHash",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "issuerDocuments",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "allMerkleRoots",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

// ═══════════════════════════════════════════════════════════════════
// Network configuration
// ═══════════════════════════════════════════════════════════════════
export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
export const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
