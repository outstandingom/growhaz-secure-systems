import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config";

// Use the user's specific GitHub Secret names
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.HARDHAT_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BLOCKCHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC_URL;

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: BLOCKCHAIN_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY]
    },
    polygon_amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY]
    }
  }
};

export default config;
