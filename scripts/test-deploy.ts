import { viem } from "hardhat";

async function main() {
  const contract = await viem.deployContract("Test");
  console.log("Deployed:", contract.address);
}

main().catch(console.error);
