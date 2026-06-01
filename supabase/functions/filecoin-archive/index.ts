// Pins a base64 file to Filecoin via Lighthouse (web3-storage style).
// Returns { cid, url, size }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KEY = Deno.env.get("LIGHTHOUSE_API_KEY");
    if (!KEY) throw new Error("LIGHTHOUSE_API_KEY not configured");

    const { fileBase64, fileName, mimeType } = await req.json();
    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: "fileBase64 and fileName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = b64ToBytes(fileBase64);
    const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });

    const form = new FormData();
    form.append("file", blob, fileName);

    const resp = await fetch("https://node.lighthouse.storage/api/v0/add", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: form,
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Lighthouse error:", resp.status, text);
      return new Response(JSON.stringify({ error: "Filecoin pin failed", details: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(text);
    const cid = data.Hash || data.cid;
    return new Response(
      JSON.stringify({
        cid,
        url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
        size: Number(data.Size || 0),
        network: "filecoin",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("filecoin-archive error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
