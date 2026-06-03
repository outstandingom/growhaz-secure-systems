import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.370.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const endpoint = Deno.env.get("FILECOIN_S3_ENDPOINT")!;
    const accessId = Deno.env.get("FILECOIN_S3_ACCESS_ID")!;
    const secretKey = Deno.env.get("FILECOIN_S3_SECRET")!;
    const bucket = Deno.env.get("FILECOIN_S3_BUCKET") || "grow1";

    const { fileName, fileBase64 } = await req.json();
    if (!fileName || !fileBase64) {
      return new Response(
        JSON.stringify({ error: "fileName and fileBase64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode base64
    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const s3 = new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: accessId,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: bytes,
      ContentType: "application/octet-stream",
    }));

    const fileUrl = `${endpoint}/${bucket}/${fileName}`;

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        bucket,
        url: fileUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Filecoin upload error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Upload failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
