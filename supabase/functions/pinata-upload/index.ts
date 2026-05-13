// Edge function: uploads a file to IPFS via Pinata and returns the CID.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PINATA_JWT = Deno.env.get("PINATA_JWT");
    if (!PINATA_JWT) throw new Error("PINATA_JWT not configured");

    const { fileBase64, fileName, mimeType, metadata } = await req.json();
    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: "fileBase64 and fileName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = base64ToBytes(fileBase64);
    const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });

    const form = new FormData();
    form.append("file", blob, fileName);
    if (metadata) {
      form.append("pinataMetadata", JSON.stringify({ name: fileName, keyvalues: metadata }));
    } else {
      form.append("pinataMetadata", JSON.stringify({ name: fileName }));
    }
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const resp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Pinata error:", resp.status, text);
      return new Response(JSON.stringify({ error: "Pinata upload failed", details: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(text);
    const cid = data.IpfsHash;
    return new Response(
      JSON.stringify({
        cid,
        url: `https://gateway.pinata.cloud/ipfs/${cid}`,
        size: data.PinSize,
        timestamp: data.Timestamp,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pinata-upload error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
