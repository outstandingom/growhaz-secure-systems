import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  website: string;
  message: string;
  service: string;
  time: string;
}

const EMAILJS_SERVICE_ID = "service_j7j2dkv";
const EMAILJS_TEMPLATE_ID = "template_yzlkk7b";
const EMAILJS_PUBLIC_KEY = "6SXFvxC9yntvDF-Ra";

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData: ContactFormData = await req.json();
    
    console.log("Received contact form data:", formData);
    
    // Get the private key from environment
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");
    
    if (!privateKey) {
      console.error("EMAILJS_PRIVATE_KEY not configured");
      throw new Error("Email service not configured properly");
    }

    // Prepare template parameters - use "Not provided" for empty fields
    const templateParams = {
      name: formData.name || "Not provided",
      email: formData.email || "Not provided",
      phone: formData.phone || "Not provided",
      website: formData.website || "Not provided",
      message: formData.message || "Not provided",
      service: formData.service || "Not specified",
      time: formData.time || new Date().toLocaleString(),
    };

    console.log("Sending email with params:", templateParams);

    // Call EmailJS API
    const emailjsResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: privateKey,
        template_params: templateParams,
      }),
    });

    const responseText = await emailjsResponse.text();
    console.log("EmailJS response status:", emailjsResponse.status);
    console.log("EmailJS response:", responseText);

    if (!emailjsResponse.ok) {
      console.error("EmailJS error:", responseText);
      throw new Error(`EmailJS error: ${responseText}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
