import { artifacts, viem } from "hardhat";
import { formatEther, parseGwei } from "viem";

const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000001" as const;
const SETUP_TX_GAS = 55_000n * 5n; // 4x setWriter + 1x setProcessManager, padded

const contracts = [
  { name: "TimelineLogger", args: [] },
  { name: "AuthorizationRegistry", args: [] },
  { name: "DocumentStatusTracker", args: [DUMMY_ADDRESS] },
  { name: "UserRegistry", args: [DUMMY_ADDRESS] },
  { name: "ProcessManager", args: [DUMMY_ADDRESS, DUMMY_ADDRESS, DUMMY_ADDRESS] },
  { name: "StepManager", args: [DUMMY_ADDRESS, DUMMY_ADDRESS] },
  { name: "MerkleDocumentRegistry", args: [] },
  { name: "DocumentRegistry", args: [] },
  { name: "DocumentAccessControl", args: [] },
] as const;

async function main() {
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const gasPrice = await publicClient.getGasPrice().catch(() => parseGwei("2"));
  const balance = await publicClient.getBalance({ address: deployer.account.address });

  let totalGas = 0n;

  console.log("Account:", deployer.account.address);
  console.log("Balance:", formatEther(balance), "ETH");
  console.log("Gas price used:", gasPrice.toString(), "wei");
  console.log("\nEstimated deployment gas:");

  for (const contract of contracts) {
    const artifact = await artifacts.readArtifact(contract.name);
    const gas = await publicClient.estimateContractGas({
      account: deployer.account,
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
      args: [...contract.args],
    });
    totalGas += gas;
    console.log(`${contract.name.padEnd(28)} ${gas.toString()} gas`);
  }

  totalGas += SETUP_TX_GAS;
  const estimatedCost = totalGas * gasPrice;

  console.log("\nSetup transactions estimate:", SETUP_TX_GAS.toString(), "gas");
  console.log("Total estimated gas:", totalGas.toString());
  console.log("Estimated ETH needed:", formatEther(estimatedCost), "ETH");
  console.log("Recommended balance:", formatEther((estimatedCost * 15n) / 10n), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });