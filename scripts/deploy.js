const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // 1. TimelineLogger (no constructor args)
  const TimelineLogger = await hre.ethers.getContractFactory("TimelineLogger");
  const timeline = await TimelineLogger.deploy();
  await timeline.deployed();
  console.log("TimelineLogger:", timeline.address);

  // 2. AuthorizationRegistry (no constructor args)
  const AuthReg = await hre.ethers.getContractFactory("AuthorizationRegistry");
  const authReg = await AuthReg.deploy();
  await authReg.deployed();
  console.log("AuthorizationRegistry:", authReg.address);

  // 3. DocumentStatusTracker (needs TimelineLogger address)
  const DocStatus = await hre.ethers.getContractFactory("DocumentStatusTracker");
  const docStatus = await DocStatus.deploy(timeline.address);
  await docStatus.deployed();
  console.log("DocumentStatusTracker:", docStatus.address);

  // 4. UserRegistry (needs TimelineLogger address)
  const UserReg = await hre.ethers.getContractFactory("UserRegistry");
  const userReg = await UserReg.deploy(timeline.address);
  await userReg.deployed();
  console.log("UserRegistry:", userReg.address);

  // 5. ProcessManager (needs all three addresses)
  const ProcMan = await hre.ethers.getContractFactory("ProcessManager");
  const procMan = await ProcMan.deploy(
    timeline.address,
    authReg.address,
    docStatus.address
  );
  await procMan.deployed();
  console.log("ProcessManager:", procMan.address);

  // 6. Wiring: allow ProcessManager & DocStatus to write to Timeline
  await timeline.setWriter(procMan.address, true);
  await timeline.setWriter(docStatus.address, true);
  await timeline.setWriter(userReg.address, true);
  console.log("Writers authorised on TimelineLogger");

  // 7. Tell DocumentStatusTracker that ProcessManager is the only caller
  await docStatus.setProcessManager(procMan.address);
  console.log("DocumentStatusTracker linked to ProcessManager");

  // 8. (Optional) Deploy remaining standalone contracts if you need them
  //    They don’t interact with the above, but you can still deploy:
  //    - MerkleDocumentRegistry
  //    - DocumentRegistry
  //    - DocumentAccessControl
  //    Example:
   const MerkleReg = await hre.ethers.getContractFactory("MerkleDocumentRegistry");
  const merkleReg = await MerkleReg.deploy();
   await merkleReg.deployed();
   console.log("MerkleDocumentRegistry:", merkleReg.address);

  // Similarly for DocumentRegistry and DocumentAccessControl (no constructor args).

  console.log("\nAll core contracts deployed and connected!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
