import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Utility to create a Google OAuth2 Token from Service Account JSON
async function getGoogleAccessToken(serviceAccount: any) {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  
  // 1. Construct JWT Header & Claim Set
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/jobs",
    aud: tokenUrl,
    exp: now + 3600,
    iat: now,
  };

  // 2. Encode and Sign
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedClaimSet = btoa(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  
  // Import the private key (PEM format)
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replaceAll("\n", "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // 3. Exchange JWT for Access Token
  const params = new URLSearchParams();
  params.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  params.append("assertion", jwt);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json();
    
    // Retrieve Service Account from Secrets
    const serviceAccountStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!serviceAccountStr) throw new Error("Missing Google Service Account Secret");
    
    const serviceAccount = JSON.parse(serviceAccountStr);
    const projectId = serviceAccount.project_id;

    // 1. Get Access Token
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // 2. Call Google Talent Solution API (v4)
    const googleUrl = `https://jobs.googleapis.com/v4/projects/${projectId}/tenants/default:completeQuery?query=${encodeURIComponent(query)}&type=JOB_TITLE&pageSize=10`;
    
    const googleRes = await fetch(googleUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await googleRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});