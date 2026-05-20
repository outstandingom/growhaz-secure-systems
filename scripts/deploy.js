const hre = require("hardhat");

async function main() {
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.deployed();

  console.log("UserRegistry deployed to:", userRegistry.address);
  console.log("Network:", hre.network.name);
  console.log("Deployer address:", (await hre.ethers.getSigners())[0].address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});