/**
 * Address + ABI for contracts/StepManager.sol (dynamic per-instance steps).
 * Deployed on Polygon Amoy. Paste VITE_STEP_MANAGER_ADDRESS into .env after
 * running `npm run contracts:deploy:amoy`.
 */
import { ethers } from "ethers";

export const STEP_MANAGER_ADDRESS =
  (import.meta.env.VITE_STEP_MANAGER_ADDRESS as string) || "";

export const isStepManagerDeployed = () => !!STEP_MANAGER_ADDRESS;

export const STEP_STATUS = ["Pending", "InProgress", "Completed", "Verified", "Rejected"] as const;
export type StepStatusName = (typeof STEP_STATUS)[number];

export function stepInstanceKey(entityType: string, entityId: string): string {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "string", "string"], [entityType, "::", entityId]),
  );
}

export const STEP_MANAGER_ABI = [
  // Events
  { anonymous: false, type: "event", name: "InstanceCreated", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: false, name: "entityType", type: "string" },
    { indexed: false, name: "entityId", type: "string" },
    { indexed: false, name: "owner", type: "address" },
    { indexed: false, name: "organisation", type: "address" },
  ]},
  { anonymous: false, type: "event", name: "StepAdded", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: true, name: "stepId", type: "uint256" },
    { indexed: false, name: "title", type: "string" },
    { indexed: false, name: "assignee", type: "address" },
  ]},
  { anonymous: false, type: "event", name: "StepStarted", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: true, name: "stepId", type: "uint256" },
    { indexed: false, name: "actor", type: "address" },
  ]},
  { anonymous: false, type: "event", name: "StepCompleted", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: true, name: "stepId", type: "uint256" },
    { indexed: false, name: "actor", type: "address" },
    { indexed: false, name: "evidenceHash", type: "string" },
    { indexed: false, name: "note", type: "string" },
  ]},
  { anonymous: false, type: "event", name: "StepVerified", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: true, name: "stepId", type: "uint256" },
    { indexed: false, name: "verifier", type: "address" },
    { indexed: false, name: "note", type: "string" },
  ]},
  { anonymous: false, type: "event", name: "StepRejected", inputs: [
    { indexed: true, name: "instanceKey", type: "bytes32" },
    { indexed: true, name: "stepId", type: "uint256" },
    { indexed: false, name: "verifier", type: "address" },
    { indexed: false, name: "reason", type: "string" },
  ]},

  // Writes
  { type: "function", stateMutability: "nonpayable", name: "createInstance",
    inputs: [
      { name: "_entityType", type: "string" },
      { name: "_entityId", type: "string" },
      { name: "_organisation", type: "address" },
      { name: "_processType", type: "string" },
    ],
    outputs: [{ name: "key", type: "bytes32" }],
  },
  { type: "function", stateMutability: "nonpayable", name: "addStep",
    inputs: [
      { name: "_instanceKey", type: "bytes32" },
      { name: "_title", type: "string" },
      { name: "_description", type: "string" },
      { name: "_assignee", type: "address" },
    ],
    outputs: [{ name: "stepId", type: "uint256" }],
  },
  { type: "function", stateMutability: "nonpayable", name: "startStep",
    inputs: [{ name: "_instanceKey", type: "bytes32" }, { name: "_stepId", type: "uint256" }],
    outputs: [],
  },
  { type: "function", stateMutability: "nonpayable", name: "completeStep",
    inputs: [
      { name: "_instanceKey", type: "bytes32" },
      { name: "_stepId", type: "uint256" },
      { name: "_evidenceHash", type: "string" },
      { name: "_note", type: "string" },
    ],
    outputs: [],
  },
  { type: "function", stateMutability: "nonpayable", name: "verifyStep",
    inputs: [
      { name: "_instanceKey", type: "bytes32" },
      { name: "_stepId", type: "uint256" },
      { name: "_note", type: "string" },
    ],
    outputs: [],
  },
  { type: "function", stateMutability: "nonpayable", name: "rejectStep",
    inputs: [
      { name: "_instanceKey", type: "bytes32" },
      { name: "_stepId", type: "uint256" },
      { name: "_reason", type: "string" },
    ],
    outputs: [],
  },

  // Views
  { type: "function", stateMutability: "view", name: "getStepCount",
    inputs: [{ name: "_instanceKey", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", stateMutability: "view", name: "getStep",
    inputs: [{ name: "_instanceKey", type: "bytes32" }, { name: "_stepId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "id", type: "uint256" },
        { name: "title", type: "string" },
        { name: "description", type: "string" },
        { name: "assignee", type: "address" },
        { name: "actor", type: "address" },
        { name: "verifier", type: "address" },
        { name: "createdAt", type: "uint256" },
        { name: "completedAt", type: "uint256" },
        { name: "verifiedAt", type: "uint256" },
        { name: "evidenceHash", type: "string" },
        { name: "completionNote", type: "string" },
        { name: "verificationNote", type: "string" },
        { name: "status", type: "uint8" },
        { name: "exists", type: "bool" },
      ],
    }],
  },
  { type: "function", stateMutability: "view", name: "instances",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "entityType", type: "string" },
      { name: "entityId", type: "string" },
      { name: "owner", type: "address" },
      { name: "organisation", type: "address" },
      { name: "processType", type: "string" },
      { name: "stepCount", type: "uint256" },
      { name: "exists", type: "bool" },
    ],
  },
] as const;
