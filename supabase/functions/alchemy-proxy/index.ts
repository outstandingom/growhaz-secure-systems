const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ALCHEMY_API_KEY = Deno.env.get("ALCHEMY_API_KEY");
    if (!ALCHEMY_API_KEY) {
      throw new Error("ALCHEMY_API_KEY not configured in Supabase secrets");
    }

    // Default to Sepolia if network is not provided
    const url = new URL(req.url);
    const network = url.searchParams.get("network") || "eth-sepolia";
    
    // Validate network to prevent arbitrary URL requests
    const allowedNetworks = ["eth-sepolia", "eth-mainnet", "polygon-mumbai", "polygon-amoy", "polygon-mainnet"];
    if (!allowedNetworks.includes(network)) {
      return new Response(JSON.stringify({ error: "Unsupported network" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const alchemyUrl = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    // Read the JSON-RPC request body from the client
    const requestBody = await req.text();

    // Forward the exact request to Alchemy
    const alchemyResponse = await fetch(alchemyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    const alchemyData = await alchemyResponse.text();

    return new Response(alchemyData, {
      status: alchemyResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Alchemy Proxy Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
