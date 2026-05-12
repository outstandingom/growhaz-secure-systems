// Proxy + helper for the external Knowledge Graph model
// Hosted at: https://outstandingom-knowledge-graph-env.hf.space
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KG_BASE = "https://outstandingom-knowledge-graph-env.hf.space";

async function kgFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${KG_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`KG ${path} ${r.status}: ${text.slice(0, 200)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, payload } = await req.json();
    let result: unknown;

    switch (action) {
      case "global_context":
        result = await kgFetch("/global-context");
        break;
      case "concepts":
        result = await kgFetch("/concepts");
        break;
      case "sentence":
        result = await kgFetch("/sentence", { method: "POST", body: JSON.stringify({ concept: payload.concept }) });
        break;
      case "search_essence":
        result = await kgFetch("/search/essence", { method: "POST", body: JSON.stringify({ concept: payload.concept, top_k: payload.top_k ?? 5 }) });
        break;
      case "search_identity":
        result = await kgFetch("/search/identity", { method: "POST", body: JSON.stringify({ concept: payload.concept, top_k: payload.top_k ?? 5 }) });
        break;
      case "add_relationship":
        result = await kgFetch("/relationships/add", {
          method: "POST",
          body: JSON.stringify({
            concept_a: payload.concept_a,
            concept_b: payload.concept_b,
            weight: payload.weight ?? 1.0,
            color: payload.color ?? "RELATED",
          }),
        });
        break;
      case "ingest_document": {
        // Bulk-add relationships from an extracted document
        const ed = payload.extracted_data || {};
        const edges: { from: string; to: string; relation: string }[] = [];
        const add = (a?: string, b?: string, rel = "RELATED") => {
          if (a && b) edges.push({ from: String(a), to: String(b), relation: rel });
        };
        const owner = ed.student_name || ed.name;
        const issuer = ed.institution || ed.issuer;
        const degree = ed.degree || ed.course || ed.title;
        const certId = ed.certificate_id || ed.id;
        const date = ed.issue_date || ed.date;

        add(owner, degree, "EARNED");
        add(degree, issuer, "ISSUED_BY");
        add(owner, issuer, "STUDIED_AT");
        add(owner, certId, "CERT_ID");
        add(degree, date, "ISSUED_ON");

        const results: unknown[] = [];
        for (const e of edges) {
          try {
            const r = await kgFetch("/relationships/add", {
              method: "POST",
              body: JSON.stringify({ concept_a: e.from, concept_b: e.to, weight: 1.0, color: e.relation }),
            });
            results.push({ ...e, ok: true, r });
          } catch (err) {
            results.push({ ...e, ok: false, error: String(err) });
          }
        }

        // Optional: a one-line description for the owner
        let sentence: string | null = null;
        if (owner) {
          try {
            const s = await kgFetch("/sentence", { method: "POST", body: JSON.stringify({ concept: owner }) }) as { sentence?: string };
            sentence = s.sentence ?? null;
          } catch (_) { /* ignore */ }
        }

        result = { edges: results, sentence };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("knowledge-graph error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
