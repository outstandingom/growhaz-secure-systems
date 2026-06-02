import { viem } from "hardhat";

async function main() {
  const [deployer] = await viem.getWalletClients();
  console.log("Deploying with:", deployer.account.address);

  // 1. TimelineLogger
  const timeline = await viem.deployContract("TimelineLogger");
  console.log("TimelineLogger:", timeline.address);

  // 2. AuthorizationRegistry
  const authReg = await viem.deployContract("AuthorizationRegistry");
  console.log("AuthorizationRegistry:", authReg.address);

  // 3. DocumentStatusTracker
  const docStatus = await viem.deployContract("DocumentStatusTracker", [timeline.address]);
  console.log("DocumentStatusTracker:", docStatus.address);

  // 4. UserRegistry
  const userReg = await viem.deployContract("UserRegistry", [timeline.address]);
  console.log("UserRegistry:", userReg.address);

  // 5. ProcessManager
  const procMan = await viem.deployContract("ProcessManager", [
    timeline.address,
    authReg.address,
    docStatus.address,
  ]);
  console.log("ProcessManager:", procMan.address);

  // 6. StepManager (dynamic per-instance steps)
  const stepMan = await viem.deployContract("StepManager", [
    timeline.address,
    authReg.address,
  ]);
  console.log("StepManager:", stepMan.address);

  // 7. Authorise writers on TimelineLogger
  await timeline.write.setWriter([procMan.address, true]);
  await timeline.write.setWriter([docStatus.address, true]);
  await timeline.write.setWriter([userReg.address, true]);
  await timeline.write.setWriter([stepMan.address, true]);
  console.log("Writers authorised on TimelineLogger");

  // 8. Link DocumentStatusTracker to ProcessManager
  await docStatus.write.setProcessManager([procMan.address]);
  console.log("DocumentStatusTracker linked to ProcessManager");

  // 9. Standalone contracts
  const merkleReg = await viem.deployContract("MerkleDocumentRegistry");
  console.log("MerkleDocumentRegistry:", merkleReg.address);

  const docReg = await viem.deployContract("DocumentRegistry");
  console.log("DocumentRegistry:", docReg.address);

  const accessCtrl = await viem.deployContract("DocumentAccessControl");
  console.log("DocumentAccessControl:", accessCtrl.address);

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
