
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
                    const docStatus = await viem.deployContract("DocumentStatusTracker", [
                        timeline.address,
                          ]);
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

                                                        // 6. Authorise writers on TimelineLogger
                                                          await timeline.write.setWriter([procMan.address, true]);
                                                            await timeline.write.setWriter([docStatus.address, true]);
                                                              await timeline.write.setWriter([userReg.address, true]);
                                                                console.log("Writers authorised on TimelineLogger");

                                                                  // 7. Link DocumentStatusTracker to ProcessManager
                                                                    await docStatus.write.setProcessManager([procMan.address]);
                                                                      console.log("DocumentStatusTracker linked to ProcessManager");

                                                                        // 8. Deploy standalone contracts
                                                                          const merkleReg = await viem.deployContract("MerkleDocumentRegistry");
                                                                            console.log("MerkleDocumentRegistry:", merkleReg.address);

                                                                              const docReg = await viem.deployContract("DocumentRegistry");
                                                                                console.log("DocumentRegistry:", docReg.address);

                                                                                  const accessCtrl = await viem.deployContract("DocumentAccessControl");
                                                                                    console.log("DocumentAccessControl:", accessCtrl.address);

                                                                                      console.log("\n✅ All contracts deployed and connected!");
                                                                                      }

                                                                                      main()
                                                                                        .then(() => process.exit(0))
                                                                                          .catch((error) => {
                                                                                              console.error(error);
                                                                                                  process.exit(1);
                                                                                                    });