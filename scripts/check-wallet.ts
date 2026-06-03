import { viem } from "hardhat";

async function main() {
  const wallets = await viem.getWalletClients();
  console.log(wallets.length);

  if(wallets[0]) {
    console.log(wallets[0].account.address);
  }
}

main().catch(console.error);
