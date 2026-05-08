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

function validateBase64(base64: string): string {
  let cleaned = base64.trim();
  if (cleaned.startsWith("data:") && cleaned.includes(",")) {
    cleaned = cleaned.split(",")[1] ?? "";
  }
  cleaned = cleaned.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("Invalid base64 image data");
  }
  return cleaned;
}

function normalizeMimeType(mime: string): string {
  const m = (mime || "").toLowerCase().trim();
  if (m === "image/heic" || m === "image/heif") {
    throw new Error("HEIC format not supported");
  }
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supported.includes(m)) {
    console.warn("[analyze-material] Unsupported MIME type, defaulting to image/jpeg:", m);
    return "image/jpeg";
  }
  return m;
}

async function analyzeImageWithAI(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<AnalysisResponse> {
  const prompt = `You are Sage, an AI assistant for StudySwap. Analyze this study material image and provide:

1. A title MUST follow EXACTLY this format: [Class Name] [Type of Material] ([Topic])
   - Replace [Class Name] with the course/class name (e.g., "AP World History", "Calculus II", "Biology 101")
   - Replace [Type of Material] with one of: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay
   - Replace [Topic] with the specific topic covered (e.g., "Enlightenment", "Integration", "Protein Structure")
   
   CORRECT EXAMPLES:
   - "AP World History Notes (Enlightenment)"
   - "Calculus II Practice Problems (Integration by Parts)"
   - "Biology 101 Study Guide (Protein Structure)"
   - "Chemistry AP Flashcards (Stoichiometry)"
   
   INCORRECT EXAMPLES (DO NOT USE):
   - "Protein Structure and Membrane Dynamics" ❌
   - "Biology Notes" ❌
   - "Study Materials" ❌

2. A brief description of what's in the material (max 150 characters)
3. The most appropriate subject (choose from: Math, Science, English, History, Foreign Language, Computer Science, Business, Art, Music, Other)
4. The material type (choose from: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay, Other)

CRITICAL: Your title MUST ALWAYS follow the format [Class Name] [Type of Material] ([Topic]). This is non-negotiable.

Respond ONLY in valid JSON format (no markdown, no extra text):
{
  "title": "[Class Name] [Type of Material] ([Topic])",
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
    temperature: 0.3, // Lower temperature for stricter format adherence
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[analyze-material] AI Gateway error response:", errorText);
    
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
  
  // Validate and fix title format if needed
  let title = parsed.title || "";
  
  // Check if title matches the required format: [Class Name] [Type of Material] ([Topic])
  const titleRegex = /^[A-Za-z0-9\s]+\s+(Notes|Textbook|Practice Problems|Study Guide|Flashcards|Essay)\s*\([^)]+\)$/;
  
  if (!titleRegex.test(title)) {
    console.warn("[analyze-material] Title does not match required format:", title);
    console.warn("[analyze-material] Expected format: [Class Name] [Type of Material] ([Topic])");
    
    // Try to reconstruct the title if it doesn't match the format
    const materialType = parsed.type || "Notes";
    const description = parsed.description || "";
    
    // Extract potential class name from description or use a generic one
    let className = "Study Material";
    if (description.includes("AP ")) {
      const apMatch = description.match(/AP\s+([A-Za-z\s]+)/i);
      if (apMatch) className = apMatch[0];
    }
    
    // Use the original title as the topic if it's not too long
    const topic = title.length < 50 ? title : description.split(" ").slice(0, 3).join(" ");
    
    title = `${className} ${materialType} (${topic})`;
    console.log("[analyze-material] Reconstructed title:", title);
  }
  
  parsed.title = title;
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

    // Validate base64
    const cleanedBase64 = validateBase64(imageBase64);
    const normalizedMimeType = normalizeMimeType(mimeType);

    const analysis = await analyzeImageWithAI(cleanedBase64, normalizedMimeType, apiKey);

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
