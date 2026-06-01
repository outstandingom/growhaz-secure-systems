/**
 * Addresses + ABIs for the 4 NEW contracts in /contracts:
 *   TimelineLogger, AuthorizationRegistry, DocumentStatusTracker, ProcessManager
 *
 * Addresses are read from VITE_* env vars so you can deploy with
 * `npx hardhat run scripts/deploy.ts --network sepolia` then paste the
 * printed addresses into your .env (see .env.example) — no code change needed.
 */

export const TIMELINE_LOGGER_ADDRESS =
  (import.meta.env.VITE_TIMELINE_LOGGER_ADDRESS as string) || "";
export const AUTHORIZATION_REGISTRY_ADDRESS =
  (import.meta.env.VITE_AUTHORIZATION_REGISTRY_ADDRESS as string) || "";
export const DOCUMENT_STATUS_TRACKER_ADDRESS =
  (import.meta.env.VITE_DOCUMENT_STATUS_TRACKER_ADDRESS as string) || "";
export const PROCESS_MANAGER_ADDRESS =
  (import.meta.env.VITE_PROCESS_MANAGER_ADDRESS as string) || "";

export const isExtraDeployed = () =>
  !!(
    TIMELINE_LOGGER_ADDRESS &&
    AUTHORIZATION_REGISTRY_ADDRESS &&
    DOCUMENT_STATUS_TRACKER_ADDRESS &&
    PROCESS_MANAGER_ADDRESS
  );

// ─── TimelineLogger ──────────────────────────────────────────────
export const TIMELINE_LOGGER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "entityType", type: "string" },
      { indexed: true, internalType: "string", name: "entityId", type: "string" },
      { indexed: false, internalType: "string", name: "action", type: "string" },
      { indexed: false, internalType: "string", name: "description", type: "string" },
      { indexed: true, internalType: "address", name: "actor", type: "address" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "TimelineEntry",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_entityType", type: "string" },
      { internalType: "string", name: "_entityId", type: "string" },
      { internalType: "string", name: "_action", type: "string" },
      { internalType: "string", name: "_description", type: "string" },
    ],
    name: "record",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_writer", type: "address" },
      { internalType: "bool", name: "_status", type: "bool" },
    ],
    name: "setWriter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── AuthorizationRegistry ──────────────────────────────────────
export const AUTHORIZATION_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "employee", type: "address" },
      { indexed: true, internalType: "address", name: "organisation", type: "address" },
      { indexed: false, internalType: "string", name: "processType", type: "string" },
      { indexed: false, internalType: "uint256", name: "expiresAt", type: "uint256" },
    ],
    name: "EmployeeAuthorised",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "employee", type: "address" },
      { indexed: true, internalType: "address", name: "organisation", type: "address" },
      { indexed: false, internalType: "string", name: "processType", type: "string" },
    ],
    name: "EmployeeRevoked",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "_employee", type: "address" },
      { internalType: "string", name: "_processType", type: "string" },
      { internalType: "uint256", name: "_expiresAt", type: "uint256" },
    ],
    name: "authorise",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_employee", type: "address" },
      { internalType: "string", name: "_processType", type: "string" },
    ],
    name: "revoke",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_employee", type: "address" },
      { internalType: "address", name: "_organisation", type: "address" },
      { internalType: "string", name: "_processType", type: "string" },
    ],
    name: "isAuthorised",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── DocumentStatusTracker ──────────────────────────────────────
export const DOCUMENT_STATUS_TRACKER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "docId", type: "string" },
      { indexed: false, internalType: "string", name: "newStatus", type: "string" },
      { indexed: false, internalType: "address", name: "updatedBy", type: "address" },
    ],
    name: "DocumentStatusChanged",
    type: "event",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "statuses",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_docId", type: "string" },
      { internalType: "string", name: "_newStatus", type: "string" },
    ],
    name: "setStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_pm", type: "address" }],
    name: "setProcessManager",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── ProcessManager ─────────────────────────────────────────────
export const PROCESS_MANAGER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "string", name: "templateId", type: "string" },
      { indexed: false, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "uint8", name: "totalSteps", type: "uint8" },
      { indexed: false, internalType: "string", name: "ipfsHash", type: "string" },
    ],
    name: "ProcessTemplateCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "instanceId", type: "bytes32" },
      { indexed: false, internalType: "string", name: "templateId", type: "string" },
      { indexed: false, internalType: "string", name: "documentId", type: "string" },
      { indexed: false, internalType: "address", name: "documentOwner", type: "address" },
    ],
    name: "InstanceStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "instanceId", type: "bytes32" },
      { indexed: false, internalType: "uint8", name: "step", type: "uint8" },
      { indexed: false, internalType: "address", name: "assignee", type: "address" },
    ],
    name: "StepAssigned",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "instanceId", type: "bytes32" },
      { indexed: false, internalType: "uint8", name: "step", type: "uint8" },
      { indexed: false, internalType: "address", name: "approver", type: "address" },
    ],
    name: "StepApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "instanceId", type: "bytes32" },
      { indexed: false, internalType: "uint8", name: "step", type: "uint8" },
      { indexed: false, internalType: "address", name: "rejector", type: "address" },
      { indexed: false, internalType: "string", name: "reason", type: "string" },
    ],
    name: "StepRejected",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_templateId", type: "string" },
      { internalType: "string", name: "_ipfsHash", type: "string" },
      { internalType: "uint8", name: "_totalSteps", type: "uint8" },
    ],
    name: "createTemplate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "_templateId", type: "string" },
      { internalType: "string", name: "_documentId", type: "string" },
    ],
    name: "startInstance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "_instanceId", type: "bytes32" },
      { internalType: "uint8", name: "_step", type: "uint8" },
      { internalType: "address", name: "_assignee", type: "address" },
    ],
    name: "assignStep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "_instanceId", type: "bytes32" },
      { internalType: "uint8", name: "_step", type: "uint8" },
    ],
    name: "approveStep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "_instanceId", type: "bytes32" },
      { internalType: "uint8", name: "_step", type: "uint8" },
      { internalType: "string", name: "_reason", type: "string" },
    ],
    name: "rejectStep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "templates",
    outputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "uint8", name: "totalSteps", type: "uint8" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "instances",
    outputs: [
      { internalType: "string", name: "templateId", type: "string" },
      { internalType: "string", name: "documentId", type: "string" },
      { internalType: "address", name: "documentOwner", type: "address" },
      { internalType: "uint8", name: "currentStep", type: "uint8" },
      { internalType: "string", name: "status", type: "string" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
