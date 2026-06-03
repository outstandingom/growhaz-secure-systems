import { viem } from "hardhat";

async function main() {
  const [wallet] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const balance = await publicClient.getBalance({
    address: wallet.account.address,
  });

  console.log("Address:", wallet.account.address);
  console.log("Balance:", balance.toString());
}

main().catch(console.error);
