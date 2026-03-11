// supabase/functions/trigger_security_scan/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { url, reportId } = await req.json()
    
    if (!url || !reportId) {
      return new Response(
        JSON.stringify({ error: "url and reportId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN")
    const repo = "outstandingom/growhaz-secure-systems"

    const githubApi = `https://api.github.com/repos/${repo}/actions/workflows/scan.yml/dispatch`

    const response = await fetch(githubApi, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          url: url,
          reportId: reportId  // Pass the report ID to GitHub workflow
        }
      })
    })

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`)
    }

    return new Response(
      JSON.stringify({ 
        status: "scan_started",
        reportId: reportId,
        message: "Scan triggered successfully" 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
