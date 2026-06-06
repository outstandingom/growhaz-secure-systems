/**
 * Address + ABI for the freshly-deployed contracts/UserRegistry.sol on Sepolia.
 *
 * This is the simple "wallet → IPFS profile CID" registry. The older complex
 * UserRegistry (with name/age/email fields) is still wired through
 * useWeb3Wallet → contractConfig.ts; keep them separate.
 */
export const USER_REGISTRY_V2_ADDRESS =
  (import.meta.env.VITE_USER_REGISTRY_V2_ADDRESS as string) || "";

export const isUserRegistryV2Deployed = () => !!USER_REGISTRY_V2_ADDRESS;

export const USER_REGISTRY_V2_ABI = [
  {
    inputs: [{ internalType: "address", name: "_timeline", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "string", name: "ipfsHash", type: "string" },
    ],
    name: "UserRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "string", name: "newIpfsHash", type: "string" },
    ],
    name: "UserUpdated",
    type: "event",
  },
  {
    inputs: [{ internalType: "string", name: "_ipfsHash", type: "string" }],
    name: "registerOrUpdate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_user", type: "address" }],
    name: "getProfile",
    outputs: [
      { internalType: "string", name: "", type: "string" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "profiles",
    outputs: [
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
