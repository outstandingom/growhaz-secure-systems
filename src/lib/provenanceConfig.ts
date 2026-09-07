/**
 * Arbitrum provenance layer configuration — used ONLY by the Document
 * Verification blockchain provenance module. Nothing else imports this file.
 */

export const PROVENANCE_REGISTRY_ADDRESS: string =
  (import.meta.env.VITE_PROVENANCE_REGISTRY_ADDRESS as string) || "";

export type ProvenanceNetworkKey = "arbitrum-sepolia" | "arbitrum-one";

export interface ProvenanceNetwork {
  key: ProvenanceNetworkKey;
  chainId: number;
  chainHex: string;
  name: string;
  rpcUrls: string[];
  explorer: string;
  symbol: string;
}

export const ARBITRUM_SEPOLIA: ProvenanceNetwork = {
  key: "arbitrum-sepolia",
  chainId: 421614,
  chainHex: "0x66eee",
  name: "Arbitrum Sepolia",
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  explorer: "https://sepolia.arbiscan.io",
  symbol: "ETH",
};

export const ARBITRUM_ONE: ProvenanceNetwork = {
  key: "arbitrum-one",
  chainId: 42161,
  chainHex: "0xa4b1",
  name: "Arbitrum One",
  rpcUrls: ["https://arb1.arbitrum.io/rpc"],
  explorer: "https://arbiscan.io",
  symbol: "ETH",
};

/** Development default. Switch by setting VITE_PROVENANCE_NETWORK=arbitrum-one. */
export const PROVENANCE_NETWORK: ProvenanceNetwork =
  (import.meta.env.VITE_PROVENANCE_NETWORK as string) === "arbitrum-one"
    ? ARBITRUM_ONE
    : ARBITRUM_SEPOLIA;

export const txUrl = (hash: string) => `${PROVENANCE_NETWORK.explorer}/tx/${hash}`;
export const addressUrl = (addr: string) => `${PROVENANCE_NETWORK.explorer}/address/${addr}`;

/** Event types mirror the Solidity enum order. */
export const EVENT_TYPES = ["REGISTERED", "UPDATED", "APPROVED", "VERIFIED"] as const;
export type ProvenanceEventType = (typeof EVENT_TYPES)[number];

/** States mirror the Solidity enum order. */
export const STATES = ["ACTIVE", "REVOKED", "SUPERSEDED"] as const;
export type ProvenanceState = (typeof STATES)[number];

export const PROVENANCE_REGISTRY_ABI = [
  "function registerRecord(string _recordId, string _fileHash, string _contentHash, string _merkleRoot, string _semanticHash, string _metadataURI) external",
  "function addVersion(string _recordId, string _fileHash, string _contentHash, string _merkleRoot, string _semanticHash, string _metadataURI, uint8 _eventType) external returns (uint256)",
  "function attestVersion(string _recordId, uint256 _version, string _role, string _statementHash) external",
  "function revokeVersion(string _recordId, uint256 _version, string _reasonHash) external",
  "function supersedeVersion(string _recordId, uint256 _oldVersion, uint256 _newVersion) external",
  "function getRecord(string _recordId) view returns (address issuer, uint256 currentVersion, uint256 createdAt, bool exists)",
  "function getVersion(string _recordId, uint256 _version) view returns (tuple(uint256 version, uint256 previousVersion, string fileHash, string contentHash, string merkleRoot, string semanticHash, string metadataURI, address actor, uint8 eventType, uint8 state, uint256 supersededBy, uint256 timestamp, bool exists))",
  "function getVersionHistory(string _recordId) view returns (tuple(uint256 version, uint256 previousVersion, string fileHash, string contentHash, string merkleRoot, string semanticHash, string metadataURI, address actor, uint8 eventType, uint8 state, uint256 supersededBy, uint256 timestamp, bool exists)[])",
  "function getAttestations(string _recordId, uint256 _version) view returns (tuple(address actor, string role, string statementHash, uint256 timestamp)[])",
  "function verifyHashes(string _recordId, uint256 _version, string _fileHash, string _contentHash) view returns (bool fileMatch, bool contentMatch, uint8 state)",
  "event RecordRegistered(string indexed recordKey, string recordId, address indexed issuer, uint256 timestamp)",
  "event VersionAdded(string indexed recordKey, string recordId, uint256 indexed version, uint256 previousVersion, address indexed actor, uint8 eventType, string fileHash, string contentHash, string merkleRoot, string semanticHash)",
  "event VersionAttested(string indexed recordKey, uint256 indexed version, address indexed actor, string role, string statementHash)",
  "event VersionRevoked(string indexed recordKey, uint256 indexed version, address indexed actor, string reasonHash)",
  "event VersionSuperseded(string indexed recordKey, uint256 indexed oldVersion, uint256 newVersion, address indexed actor)",
];
