import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. TimelineLogger
  const TimelineLogger = await ethers.getContractFactory("TimelineLogger");
  const timeline = await TimelineLogger.deploy();
  await timeline.deployed();
  console.log("TimelineLogger:", timeline.address);

  // 2. AuthorizationRegistry
  const AuthReg = await ethers.getContractFactory("AuthorizationRegistry");
  const authReg = await AuthReg.deploy();
  await authReg.deployed();
  console.log("AuthorizationRegistry:", authReg.address);

  // 3. DocumentStatusTracker
  const DocStatus = await ethers.getContractFactory("DocumentStatusTracker");
  const docStatus = await DocStatus.deploy(timeline.address);
  await docStatus.deployed();
  console.log("DocumentStatusTracker:", docStatus.address);

  // 4. UserRegistry
  const UserReg = await ethers.getContractFactory("UserRegistry");
  const userReg = await UserReg.deploy(timeline.address);
  await userReg.deployed();
  console.log("UserRegistry:", userReg.address);

  // 5. ProcessManager
  const ProcMan = await ethers.getContractFactory("ProcessManager");
  const procMan = await ProcMan.deploy(
    timeline.address,
    authReg.address,
    docStatus.address
  );
  await procMan.deployed();
  console.log("ProcessManager:", procMan.address);

  // 6. Authorise writers on TimelineLogger
  await timeline.setWriter(procMan.address, true);
  await timeline.setWriter(docStatus.address, true);
  await timeline.setWriter(userReg.address, true);
  console.log("Writers authorised on TimelineLogger");

  // 7. Link DocumentStatusTracker to ProcessManager
  await docStatus.setProcessManager(procMan.address);
  console.log("DocumentStatusTracker linked to ProcessManager");

  // 8. Deploy standalone contracts
  const MerkleReg = await ethers.getContractFactory("MerkleDocumentRegistry");
  const merkleReg = await MerkleReg.deploy();
  await merkleReg.deployed();
  console.log("MerkleDocumentRegistry:", merkleReg.address);

  const DocReg = await ethers.getContractFactory("DocumentRegistry");
  const docReg = await DocReg.deploy();
  await docReg.deployed();
  console.log("DocumentRegistry:", docReg.address);

  const AccessCtrl = await ethers.getContractFactory("DocumentAccessControl");
  const accessCtrl = await AccessCtrl.deploy();
  await accessCtrl.deployed();
  console.log("DocumentAccessControl:", accessCtrl.address);

  console.log("\n✅ All contracts deployed and connected!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
