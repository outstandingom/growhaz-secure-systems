// Edge function: registers a document on the DocumentRegistry smart contract.
// Calls registerDocument(fileHash, contentHash, ipfsCid) and returns tx info.
import { ethers } from "npm:ethers@6.13.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONTRACT_ADDRESS = "0xaDe3aaef7d81c4eA28ee70c9492Df2c841D14642";

const ABI = [
  "function registerDocument(string _fileHash, string _contentHash, string _ipfsCid) public",
  "function verifyDocument(string _fileHash) public view returns (string, string, address, uint256)",
  "event DocumentRegistered(string fileHash, string contentHash, string ipfsCid, address issuer, uint256 timestamp)",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RPC_URL = Deno.env.get("BLOCKCHAIN_RPC_URL");
    const PRIVATE_KEY = Deno.env.get("BLOCKCHAIN_PRIVATE_KEY");
    if (!RPC_URL) throw new Error("BLOCKCHAIN_RPC_URL not configured");
    if (!PRIVATE_KEY) throw new Error("BLOCKCHAIN_PRIVATE_KEY not configured");

    const body = await req.json();
    const { action = "register", fileHash, contentHash, ipfsCid } = body;

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    if (action === "verify") {
      if (!fileHash) throw new Error("fileHash required");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const [ipfs, content, issuer, timestamp] = await contract.verifyDocument(fileHash);
      return new Response(
        JSON.stringify({
          ipfsCid: ipfs,
          contentHash: content,
          issuer,
          timestamp: Number(timestamp),
          contractAddress: CONTRACT_ADDRESS,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fileHash || !contentHash || !ipfsCid) {
      return new Response(
        JSON.stringify({ error: "fileHash, contentHash and ipfsCid are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    const tx = await contract.registerDocument(fileHash, contentHash, ipfsCid);
    const receipt = await tx.wait();

    return new Response(
      JSON.stringify({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        issuer: wallet.address,
        contractAddress: CONTRACT_ADDRESS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("blockchain-register error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
