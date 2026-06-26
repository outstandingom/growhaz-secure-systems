import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanRequest {
  url: string
  reportId: string
  scannerVersion?: 'alpha-g1' | 'alpha-g2'  // Optional, defaults to alpha-g2
  enableJs?: boolean                         // Optional, for alpha-g2
  testEmail?: string                         // Optional test email
  openapiSpec?: string                        // Optional OpenAPI spec path
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Scan request received')
    const { 
      url, 
      reportId, 
      scannerVersion = 'alpha-g2',
      enableJs = false,
      testEmail,
      openapiSpec 
    } = await req.json() as ScanRequest
    
    console.log('📦 Payload:', { 
      url, 
      reportId, 
      scannerVersion, 
      enableJs, 
      testEmail: testEmail ? 'provided' : 'not provided',
      openapiSpec: openapiSpec ? 'provided' : 'not provided'
    })

    // Validation
    if (!url || !reportId) {
      return new Response(
        JSON.stringify({ error: "url and reportId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN")
    console.log('🔑 GITHUB_TOKEN present:', !!githubToken)

    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const repo = Deno.env.get("GITHUB_REPO") || "outstandingom/growhaz-secure-systems"
    const githubApi = `https://api.github.com/repos/${repo}/actions/workflows/security-scan.yml/dispatches`
    console.log('📡 Calling GitHub API:', githubApi)

    // Prepare workflow inputs
    const workflowInputs: any = {
      url,
      reportId,
      scanner_version: scannerVersion
    }

    // Add optional parameters
    if (scannerVersion === 'alpha-g2' && enableJs) {
      workflowInputs.enable_js = 'true'
    }
    
    if (testEmail) {
      workflowInputs.test_email = testEmail
    }
    
    if (openapiSpec) {
      workflowInputs.openapi_spec = openapiSpec
    }

    const response = await fetch(githubApi, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: "main", // or the branch you want to trigger
        inputs: workflowInputs
      })
    })

    console.log('📊 GitHub API status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GitHub API error:', errorText)
      
      // Try to parse GitHub API error
      let errorMessage = `GitHub API error (${response.status})`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorMessage
      } catch {
        errorMessage += `: ${errorText}`
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    console.log('✅ Scan triggered successfully')

    return new Response(
      JSON.stringify({ 
        status: "scan_started", 
        reportId,
        scannerVersion,
        message: `Alpha ${scannerVersion === 'alpha-g1' ? 'G1' : 'G2'} scan initiated successfully`,
        details: {
          url,
          reportId,
          scannerVersion,
          enableJs: enableJs && scannerVersion === 'alpha-g2',
          testEmail: !!testEmail,
          openapiSpec: !!openapiSpec
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (error) {
    console.error('💥 Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
})
