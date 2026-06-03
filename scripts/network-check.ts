import { viem } from "hardhat";

async function main() {
  const client = await viem.getPublicClient();

  console.log(
    await client.getChainId()
  );
}

main().catch(console.error);
