// Edge function: extracts document text via Lovable AI, builds knowledge graph,
// performs logical validation, and returns structured data + content hash.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an intelligent document verification AI. Perform OCR and extract ALL readable text verbatim from the document image (every word, number, date, name, ID — preserve order, ignore decorative noise). Then extract structured data, build a knowledge graph of entities and their relationships, and perform logical validation. Detect inconsistencies (e.g. degree-course mismatch, timeline issues, institution-accreditation conflicts). Always call the extract_document tool and ALWAYS populate raw_text with the complete OCR output.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract and validate this document.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/png"};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_document",
                description: "Extract structured document data and validate logically",
                parameters: {
                  type: "object",
                  properties: {
                    document_type: { type: "string", description: "e.g. Degree, Diploma, Certificate, ID" },
                    raw_text: { type: "string", description: "Full verbatim OCR text of the document — every readable word preserved." },
                    extracted_data: {
                      type: "object",
                      properties: {
                        student_name: { type: "string" },
                        degree: { type: "string" },
                        course: { type: "string" },
                        institution: { type: "string" },
                        issue_date: { type: "string" },
                        certificate_id: { type: "string" },
                      },
                    },
                    knowledge_graph: {
                      type: "object",
                      description: "Entity relationships",
                      properties: {
                        nodes: { type: "array", items: { type: "string" } },
                        edges: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              from: { type: "string" },
                              to: { type: "string" },
                              relation: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                    validation: {
                      type: "object",
                      properties: {
                        status: { type: "string", enum: ["authentic", "valid", "tampered", "suspicious"] },
                        issues: { type: "array", items: { type: "string" } },
                        explanation: { type: "string" },
                      },
                      required: ["status", "explanation"],
                    },
                  },
                  required: ["document_type", "extracted_data", "knowledge_graph", "validation"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_document" } },
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");
    const parsed = JSON.parse(toolCall.function.arguments);

    // Stable content hash from the FULL OCR text — same content yields the same
    // hash regardless of file format / compression / resize. Mirrors the Node.js
    // reference: cleanText -> normalizeForHash -> SHA-256.
    const ed = parsed.extracted_data || {};
    const rawText: string = String(parsed.raw_text || "").trim();

    // Fallback: if AI didn't return raw_text, synthesise from extracted fields
    const fallbackText = [
      ed.student_name || ed.name,
      ed.certificate_id || ed.id,
      ed.issue_date || ed.date,
      ed.institution || ed.issuer,
      ed.degree || ed.course || ed.title,
    ].filter(Boolean).join(" ");

    const sourceText = rawText.length >= 10 ? rawText : fallbackText;

    // cleanText: collapse whitespace, strip noise chars
    const cleaned = sourceText
      .replace(/\s+/g, " ")
      .replace(/[@©•]/g, "")
      .replace(/[^\w\s:/@.-]/g, " ")
      .trim();

    // normalizeForHash: lowercase + remove all non-word chars (incl. spaces)
    const canonical = cleaned.toLowerCase().replace(/\s+/g, "").replace(/[^\w]/g, "");
    const contentHash = await sha256(canonical);

    // Push extracted entities into the external Knowledge Graph model and
    // merge the resulting relationships into the response. Best-effort — never
    // fail the verification if the KG service is unreachable.
    let kgIngest: unknown = null;
    try {
      const KG_BASE = "https://outstandingom-knowledge-graph-env.hf.space";
      const owner = ed.student_name || ed.name;
      const issuer = ed.institution || ed.issuer;
      const degree = ed.degree || ed.course || ed.title;
      const certId = ed.certificate_id || ed.id;
      const date = ed.issue_date || ed.date;
      const edges: { from: string; to: string; relation: string }[] = [];
      const add = (a?: string, b?: string, rel = "RELATED") => {
        if (a && b) edges.push({ from: String(a), to: String(b), relation: rel });
      };
      add(owner, degree, "EARNED");
      add(degree, issuer, "ISSUED_BY");
      add(owner, issuer, "STUDIED_AT");
      add(owner, certId, "CERT_ID");
      add(degree, date, "ISSUED_ON");

      const ingested: { from: string; to: string; relation: string; ok: boolean }[] = [];
      for (const e of edges) {
        try {
          const r = await fetch(`${KG_BASE}/relationships/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concept_a: e.from, concept_b: e.to, weight: 1.0, color: e.relation }),
          });
          ingested.push({ ...e, ok: r.ok });
        } catch (_) {
          ingested.push({ ...e, ok: false });
        }
      }

      let sentence: string | null = null;
      if (owner) {
        try {
          const sr = await fetch(`${KG_BASE}/sentence`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concept: owner }),
          });
          if (sr.ok) {
            const sj = await sr.json();
            sentence = sj?.sentence ?? null;
          }
        } catch (_) { /* ignore */ }
      }

      // Merge external KG edges into the parsed knowledge_graph
      const kgNodes = new Set<string>([
        ...((parsed.knowledge_graph?.nodes ?? []) as string[]),
        ...edges.flatMap((e) => [e.from, e.to]),
      ]);
      parsed.knowledge_graph = {
        nodes: Array.from(kgNodes),
        edges: [...((parsed.knowledge_graph?.edges ?? []) as unknown[]), ...edges],
      };
      kgIngest = { ingested, sentence };
    } catch (e) {
      console.error("KG ingest failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({
        ...parsed,
        content_hash: contentHash,
        canonical_text: canonical,
        kg: kgIngest,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("verify-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
