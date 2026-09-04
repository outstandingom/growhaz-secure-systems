// Gasless blockchain anchoring.
// The platform wallet signs and pays gas on the user's behalf; the user pays in coins.
// Returns transaction hash + block hash so anyone can independently verify the record.
import { ethers } from "npm:ethers@6.13.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REGISTRY_ADDRESS = "0x358AA13c52544ECCEF6B0ADD0f801012ADAD5eE3"; // DocumentRegistry V2 (Sepolia)
const NETWORK = "sepolia";
const EXPLORER = "https://sepolia.etherscan.io";
export const ANCHOR_PRICE_COINS = 99;

const ABI = [
  "function registerDocument(string _docId, string _merkleRoot, string _fileHash, string _contentIpfsCid, string _metadataIpfsCid, uint256 _totalChunks, string _docType) public",
  "function getDocument(string _docId) public view returns (string,string,string,string,uint256,address,uint256,string)",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let documentId: string | undefined;
  let userId: string | undefined;
  let charged = false;

  try {
    // ── Auth: manually parse the Bearer token ───────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
    userId = userData.user.id;

    const body = await req.json();
    documentId = body.documentId;
    const action = body.action ?? "anchor";

    if (!documentId) return json({ error: "documentId is required" }, 400);

    const { data: doc, error: docErr } = await admin
      .from("verified_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: "Document not found" }, 404);
    if (doc.user_id !== userId) return json({ error: "Not your document" }, 403);

    // ── Quote only ──────────────────────────────────────────────────────
    if (action === "quote") {
      return json({
        priceCoins: ANCHOR_PRICE_COINS,
        network: NETWORK,
        contractAddress: REGISTRY_ADDRESS,
        alreadyAnchored: doc.anchor_status === "anchored",
      });
    }

    if (doc.anchor_status === "anchored" && doc.chain_tx_hash) {
      return json({
        alreadyAnchored: true,
        txHash: doc.chain_tx_hash,
        blockHash: doc.chain_block_hash,
        blockNumber: doc.chain_block_number,
        explorerUrl: doc.chain_explorer_url,
        network: doc.chain_network ?? NETWORK,
        contractAddress: doc.chain_contract_address ?? REGISTRY_ADDRESS,
      });
    }

    const RPC_URL = Deno.env.get("BLOCKCHAIN_RPC_URL");
    const PRIVATE_KEY = Deno.env.get("BLOCKCHAIN_PRIVATE_KEY");
    if (!RPC_URL || !PRIVATE_KEY) {
      return json({ error: "Blockchain signer is not configured" }, 500);
    }

    // ── Charge the user in coins (server side, before sending the tx) ───
    const { error: payErr } = await admin.rpc("spend_user_coins", {
      p_user_id: userId,
      p_amount: ANCHOR_PRICE_COINS,
      p_description: `Blockchain anchoring: ${doc.document_name}`,
    });
    if (payErr) {
      return json({ error: payErr.message || "Payment failed" }, 402);
    }
    charged = true;

    await admin
      .from("verified_documents")
      .update({ anchor_status: "pending", anchor_error: null })
      .eq("id", documentId);

    // ── Send the transaction from the platform wallet (gasless for user) ─
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(REGISTRY_ADDRESS, ABI, wallet);

    const docKey = doc.tracking_id || doc.id;
    const merkleRoot = doc.merkle_root || doc.content_hash;
    const totalChunks = Number(
      (doc.extracted_data as Record<string, unknown> | null)?.["totalChunks"] ?? 0
    );

    const tx = await contract.registerDocument(
      docKey,
      merkleRoot,
      doc.file_hash,
      doc.ipfs_cid || "",
      doc.content_hash,
      isNaN(totalChunks) ? 0 : totalChunks,
      doc.document_type || "document"
    );
    const receipt = await tx.wait();

    const blockHash = receipt?.blockHash ?? null;
    const blockNumber = receipt?.blockNumber ?? null;
    const explorerUrl = `${EXPLORER}/tx/${tx.hash}`;

    await admin
      .from("verified_documents")
      .update({
        anchor_status: "anchored",
        status: "verified",
        chain_tx_hash: tx.hash,
        blockchain_tx: tx.hash,
        chain_block_hash: blockHash,
        chain_block_number: blockNumber,
        chain_contract_address: REGISTRY_ADDRESS,
        chain_issuer_address: wallet.address,
        chain_network: NETWORK,
        chain_explorer_url: explorerUrl,
        anchor_cost_coins: ANCHOR_PRICE_COINS,
        anchored_at: new Date().toISOString(),
        anchor_error: null,
      })
      .eq("id", documentId);

    return json({
      success: true,
      txHash: tx.hash,
      blockHash,
      blockNumber,
      explorerUrl,
      network: NETWORK,
      issuer: wallet.address,
      contractAddress: REGISTRY_ADDRESS,
      chargedCoins: ANCHOR_PRICE_COINS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("anchor-document error:", msg);

    // Refund coins if we charged but the chain write failed.
    if (charged && userId) {
      try {
        await admin.rpc("update_coin_balance", {
          p_user_id: userId,
          p_amount: ANCHOR_PRICE_COINS,
          p_transaction_type: "refund",
          p_description: "Refund: blockchain anchoring failed",
        });
      } catch (_) {
        console.error("refund failed for user", userId);
      }
    }
    if (documentId) {
      await admin
        .from("verified_documents")
        .update({ anchor_status: "failed", anchor_error: msg })
        .eq("id", documentId);
    }

    return json({ error: msg }, 500);
  }
});
