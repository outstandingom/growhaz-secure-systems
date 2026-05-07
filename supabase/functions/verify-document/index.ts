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

    const systemPrompt = `You are an intelligent document verification AI. Extract structured data from the document image, build a knowledge graph of entities and their relationships, and perform logical validation. Detect inconsistencies (e.g. degree-course mismatch, timeline issues, institution-accreditation conflicts). Always call the extract_document tool.`;

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

    // Content hash from normalized extracted data (semantic, format-independent)
    const normalized = JSON.stringify(parsed.extracted_data, Object.keys(parsed.extracted_data).sort());
    const contentHash = await sha256(normalized.toLowerCase().replace(/\s+/g, " ").trim());

    return new Response(
      JSON.stringify({
        ...parsed,
        content_hash: contentHash,
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
