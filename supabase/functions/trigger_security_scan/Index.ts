import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('POST request received')
    const { url, reportId } = await req.json()
    console.log('Payload:', { url, reportId })

    if (!url || !reportId) {
      return new Response(
        JSON.stringify({ error: "url and reportId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN")
    console.log('GITHUB_TOKEN present:', !!githubToken)

    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const repo = "outstandingom/growhaz-secure-systems"
    const githubApi = `https://api.github.com/repos/${repo}/actions/workflows/scan.yml/dispatches`
    console.log('Calling GitHub API:', githubApi)

    const response = await fetch(githubApi, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { url, reportId }
      })
    })

    console.log('GitHub API status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('GitHub API error:', errorText)
      return new Response(
        JSON.stringify({ error: `GitHub API error (${response.status}): ${errorText}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    return new Response(
      JSON.stringify({ status: "scan_started", reportId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
})
