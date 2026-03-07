import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {

  const { url } = await req.json()

  const githubToken = Deno.env.get("GITHUB_TOKEN")
  const repo = "outstandingom/growhaz-secure-systems"

  const githubApi = `https://api.github.com/repos/${repo}/actions/workflows/scan.yml/dispatches`

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
        url: url
      }
    })
  })

  return new Response(
    JSON.stringify({ status: "scan_started" }),
    { headers: { "Content-Type": "application/json" } }
  )

})
