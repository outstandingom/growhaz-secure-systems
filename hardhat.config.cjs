require("dotenv").config();
// Register ts-node so Hardhat can run TypeScript tests and scripts
try {
  require("ts-node").register({ transpileOnly: true });
} catch (e) {
  // ts-node may not be installed in all environments; ignore if missing
}
require("@nomicfoundation/hardhat-toolbox-viem");

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BLOCKCHAIN_PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.HARDHAT_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BLOCKCHAIN_RPC_URL = process.env.ALCHEMY_SEPOLIA_URL;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    sepolia: {
      url: BLOCKCHAIN_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY],
      chainId: 11155111,
    },
    amoy: {
      url: BLOCKCHAIN_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY],
      chainId: 80002,
    },
    polygon_amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY],
      chainId: 80002,
    },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
};

