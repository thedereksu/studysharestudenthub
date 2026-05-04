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

  console.log("[analyze-material] Calling AI Gateway...");
  
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });

  console.log("[analyze-material] AI Gateway response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[analyze-material] AI Gateway error:", errorText);
    throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log("[analyze-material] AI response received");
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error("Invalid AI response format");
  }
  
  const content = data.choices[0].message.content;

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[analyze-material] Could not parse JSON from:", content);
    throw new Error("Could not parse AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  console.log("[analyze-material] Successfully parsed:", parsed);
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
        JSON.stringify({ error: "Server configuration error" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    const analysis = await analyzeWithAI(imageBase64, mimeType, apiKey);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[analyze-material] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Analysis failed" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
