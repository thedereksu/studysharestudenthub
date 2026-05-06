const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
  "Access-Control-Max-Age": "86400",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash";

interface AnalysisRequest {
  imageBase64?: string;
  mimeType: string;
  fileBase64?: string;
  fileName?: string;
}

interface AnalysisResponse {
  title: string;
  description: string;
  subject: string;
  type: string;
}

function cleanBase64(input: string): string {
  if (!input) return "";
  let cleaned = input.trim();
  // Strip data URI prefix if present
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1] ?? "";
  }
  // Remove all whitespace/newlines
  cleaned = cleaned.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("Invalid base64 image data");
  }
  return cleaned;
}

function normalizeMimeType(mime: string): string {
  const m = (mime || "").toLowerCase().trim();
  // Gemini supports png, jpeg, webp, gif. Reject HEIC explicitly.
  if (m === "image/heic" || m === "image/heif") {
    throw new Error("HEIC/HEIF images aren't supported. Please use JPG, PNG, or WEBP.");
  }
  if (m === "image/jpg") return "image/jpeg";
  return m || "image/jpeg";
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function extractPdfText(b64: string): Promise<string> {
  const bytes = base64ToBytes(b64);
  if (bytes.byteLength > 20 * 1024 * 1024) {
    throw new Error("PDF too large. Please use one under 20MB.");
  }
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (text || "").slice(0, 40000);
}

async function analyzeTextWithAI(text: string, fileName: string, apiKey: string): Promise<AnalysisResponse> {
  const prompt = `You are Sage, an AI assistant for StudySwap. Analyze this study material${fileName ? ` (filename: ${fileName})` : ""} and provide:
1. A concise, descriptive title (max 50 characters)
2. A brief description of what's in the material (max 150 characters)
3. The most appropriate subject (choose from: Math, Science, English, History, Foreign Language, Computer Science, Business, Art, Music, Other)
4. The material type (choose from: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay, Other)

Respond ONLY in JSON format:
{"title":"...","description":"...","subject":"...","type":"..."}

--- MATERIAL CONTENT ---
${text}`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response as JSON");
  return JSON.parse(jsonMatch[0]);
}

async function analyzeWithAI(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<AnalysisResponse> {
  const prompt = `You are Sage, an AI assistant for StudySwap. Analyze this study material image and provide:
1. A concise, descriptive title (max 50 characters)
2. A brief description of what's in the material (max 150 characters)
3. The most appropriate subject (choose from: Math, Science, English, History, Foreign Language, Computer Science, Business, Art, Music, Other)
4. The material type (choose from: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay, Other)

Respond in JSON format:
{
  "title": "...",
  "description": "...",
  "subject": "...",
  "type": "..."
}`;

  console.log("[analyze-material] Image size:", imageBase64.length, "bytes");
  console.log("[analyze-material] MIME type:", mimeType);
  console.log("[analyze-material] Calling AI Gateway at:", AI_GATEWAY_URL);
  console.log("[analyze-material] Using model:", VISION_MODEL);
  
  const requestBody = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.7,
  };

  console.log("[analyze-material] Request body size:", JSON.stringify(requestBody).length, "bytes");
  
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[analyze-material] AI Gateway response status:", response.status);
  console.log("[analyze-material] Response headers:", Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[analyze-material] AI Gateway error response:", errorText);
    
    // Try to parse error details
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorJson.message || errorText;
    } catch (e) {
      // Not JSON, use raw text
    }
    
    throw new Error(`AI Gateway error: ${response.status} ${response.statusText} - ${errorDetail}`);
  }

  const data = await response.json();
  console.log("[analyze-material] AI response received, choices count:", data.choices?.length);
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error("[analyze-material] Invalid response structure:", data);
    throw new Error("Invalid AI response format");
  }
  
  const content = data.choices[0].message.content;
  console.log("[analyze-material] Message content:", content);

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[analyze-material] Could not parse JSON from content:", content);
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  console.log("[analyze-material] Successfully parsed analysis:", parsed);
  return parsed;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[analyze-material] Request received, method:", req.method);
    
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
          status: 405, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }
    
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[analyze-material] Failed to parse JSON:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }
    
    const { imageBase64, mimeType, fileBase64, fileName } = body as AnalysisRequest;
    const rawBase64 = fileBase64 ?? imageBase64;

    if (!rawBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing file data or mimeType" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let cleanedBase64: string;
    try {
      cleanedBase64 = cleanBase64(rawBase64);
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const mimeLower = (mimeType || "").toLowerCase();
    const isPdf = mimeLower === "application/pdf";
    const isImage = mimeLower.startsWith("image/");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[analyze-material] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error: API key not found" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    console.log("[analyze-material] API key found, length:", apiKey.length);

    let analysis: AnalysisResponse;
    if (isPdf) {
      const text = await extractPdfText(cleanedBase64);
      if (!text.trim()) throw new Error("Could not extract text from PDF (it may be scanned/image-only).");
      analysis = await analyzeTextWithAI(text, fileName || "", apiKey);
    } else if (isImage) {
      const normalizedMime = normalizeMimeType(mimeType);
      const approxBytes = Math.floor((cleanedBase64.length * 3) / 4);
      if (approxBytes > 15 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: "Image is too large. Please use one under 15MB." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      analysis = await analyzeWithAI(cleanedBase64, normalizedMime, apiKey);
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mimeType}. Use an image or PDF.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[analyze-material] Error:", error.message);
    console.error("[analyze-material] Error stack:", error.stack);
    const msg: string = error?.message || "Analysis failed";
    let status = 500;
    if (msg.includes("429")) status = 429;
    else if (msg.includes("402")) status = 402;
    return new Response(
      JSON.stringify({ error: msg }),
      { 
        status, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
