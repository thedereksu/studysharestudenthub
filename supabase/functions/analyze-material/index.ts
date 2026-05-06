const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
  "Access-Control-Max-Age": "86400",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash";

interface AnalysisRequest {
  imageBase64: string;
  mimeType: string;
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
    
    const { imageBase64, mimeType } = body as AnalysisRequest;

    if (!imageBase64 || !mimeType) {
      console.error("[analyze-material] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

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

    const analysis = await analyzeWithAI(imageBase64, mimeType, apiKey);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[analyze-material] Error:", error.message);
    console.error("[analyze-material] Error stack:", error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Analysis failed" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
