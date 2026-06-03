import { viem } from "hardhat";
import { formatEther } from "viem";

const SEPOLIA_MIN_ETH_FOR_FULL_DEPLOY = 0.01;

async function deployWithLabel<T>(label: string, deploy: () => Promise<T & { address: `0x${string}` }>) {
  console.log(`\nDeploying ${label}...`);
  try {
    const contract = await deploy();
    console.log(`${label}:`, contract.address);
    return contract;
  } catch (error) {
    console.error(`\n❌ ${label} deployment failed.`);
    throw error;
  }
}

async function writeWithLabel(label: string, write: () => Promise<unknown>) {
  console.log(`Running: ${label}...`);
  try {
    await write();
    console.log(`Done: ${label}`);
  } catch (error) {
    console.error(`\n❌ Failed while running: ${label}`);
    throw error;
  }
}

async function main() {
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  const balanceEth = Number(formatEther(balance));

  console.log("Deploying with:", deployer.account.address);
  console.log("Sepolia ETH balance:", formatEther(balance));

  if (balanceEth < SEPOLIA_MIN_ETH_FOR_FULL_DEPLOY) {
    throw new Error(
      `Balance too low for full deployment. You have ${formatEther(balance)} Sepolia ETH. ` +
      `For all contracts + setup transactions, fund at least ${SEPOLIA_MIN_ETH_FOR_FULL_DEPLOY} Sepolia ETH, then run again.`
    );
  }

  // 1. TimelineLogger
  const timeline = await deployWithLabel("TimelineLogger", () => viem.deployContract("TimelineLogger"));

  // 2. AuthorizationRegistry
  const authReg = await deployWithLabel("AuthorizationRegistry", () => viem.deployContract("AuthorizationRegistry"));

  // 3. DocumentStatusTracker
  const docStatus = await deployWithLabel("DocumentStatusTracker", () => viem.deployContract("DocumentStatusTracker", [timeline.address]));

  // 4. UserRegistry
  const userReg = await deployWithLabel("UserRegistry", () => viem.deployContract("UserRegistry", [timeline.address]));

  // 5. ProcessManager
  const procMan = await deployWithLabel("ProcessManager", () => viem.deployContract("ProcessManager", [
    timeline.address,
    authReg.address,
    docStatus.address,
  ]));

  // 6. StepManager (dynamic per-instance steps)
  const stepMan = await deployWithLabel("StepManager", () => viem.deployContract("StepManager", [
    timeline.address,
    authReg.address,
  ]));

  // 7. Authorise writers on TimelineLogger
  await writeWithLabel("authorise ProcessManager timeline writer", () => timeline.write.setWriter([procMan.address, true]));
  await writeWithLabel("authorise DocumentStatusTracker timeline writer", () => timeline.write.setWriter([docStatus.address, true]));
  await writeWithLabel("authorise UserRegistry timeline writer", () => timeline.write.setWriter([userReg.address, true]));
  await writeWithLabel("authorise StepManager timeline writer", () => timeline.write.setWriter([stepMan.address, true]));
  console.log("Writers authorised on TimelineLogger");

  // 8. Link DocumentStatusTracker to ProcessManager
  await writeWithLabel("link DocumentStatusTracker to ProcessManager", () => docStatus.write.setProcessManager([procMan.address]));
  console.log("DocumentStatusTracker linked to ProcessManager");

  // 9. Standalone contracts
  const merkleReg = await deployWithLabel("MerkleDocumentRegistry", () => viem.deployContract("MerkleDocumentRegistry"));

  const docReg = await deployWithLabel("DocumentRegistry", () => viem.deployContract("DocumentRegistry"));

  const accessCtrl = await deployWithLabel("DocumentAccessControl", () => viem.deployContract("DocumentAccessControl"));

  console.log("\n✅ All contracts deployed and connected!");
  console.log("\nAdd these to your .env / Lovable env vars:");
  console.log(`VITE_TIMELINE_LOGGER_ADDRESS=${timeline.address}`);
  console.log(`VITE_AUTHORIZATION_REGISTRY_ADDRESS=${authReg.address}`);
  console.log(`VITE_DOCUMENT_STATUS_TRACKER_ADDRESS=${docStatus.address}`);
  console.log(`VITE_USER_REGISTRY_ADDRESS=${userReg.address}`);
  console.log(`VITE_PROCESS_MANAGER_ADDRESS=${procMan.address}`);
  console.log(`VITE_STEP_MANAGER_ADDRESS=${stepMan.address}`);
  console.log(`VITE_MERKLE_REGISTRY_ADDRESS=${merkleReg.address}`);
  console.log(`VITE_DOCUMENT_REGISTRY_ADDRESS=${docReg.address}`);
  console.log(`VITE_DOCUMENT_ACCESS_CONTROL_ADDRESS=${accessCtrl.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
