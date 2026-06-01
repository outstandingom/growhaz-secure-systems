require("dotenv/config");
// Register ts-node so Hardhat can run TypeScript tests and scripts
try {
  require("ts-node").register({ transpileOnly: true });
} catch (e) {
  // ts-node may not be installed in all environments; ignore if missing
}
require("@nomicfoundation/hardhat-toolbox-viem");

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const BLOCKCHAIN_PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.HARDHAT_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const BLOCKCHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC_URL;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    sepolia: {
      url: BLOCKCHAIN_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY],
      chainId: 11155111,
    },
    polygon_amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [BLOCKCHAIN_PRIVATE_KEY],
    },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
};

