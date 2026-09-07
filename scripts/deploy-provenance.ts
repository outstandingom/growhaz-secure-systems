/**
 * Deploys ONLY the ProvenanceRegistry contract (document-verification
 * provenance layer). Unrelated contracts are untouched.
 *
 *   npx hardhat run scripts/deploy-provenance.ts --network arbitrumSepolia
 *   npx hardhat run scripts/deploy-provenance.ts --network arbitrumOne
 *
 * After deploying, put the printed address in .env as:
 *   VITE_PROVENANCE_REGISTRY_ADDRESS=0x...
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const address = deployer.account.address;
  const balance = await publicClient.getBalance({ address });

  console.log("Network :", hre.network.name);
  console.log("Deployer:", address);
  console.log("Balance :", hre.ethers ? balance.toString() : balance.toString(), "wei");

  const registry = await hre.viem.deployContract("ProvenanceRegistry");
  console.log("\nProvenanceRegistry deployed at:", registry.address);
  console.log("\nAdd to .env:\nVITE_PROVENANCE_REGISTRY_ADDRESS=" + registry.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
