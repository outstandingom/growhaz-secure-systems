import { viem } from "hardhat";

async function main() {
  const contract = await viem.deployContract("AuthorizationRegistry");
  console.log("DEPLOYED:", contract.address);
}

main().catch(console.error);
