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
  fileName?: string;
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
    throw new Error("Invalid base64 data");
  }
  return cleaned;
}

function normalizeMimeType(mime: string): string {
  const m = (mime || "").toLowerCase().trim();
  if (m === "image/heic" || m === "image/heif") {
    throw new Error("HEIC format not supported");
  }
  // Support images and PDFs
  const supportedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const supportedDocs = ["application/pdf"];
  const allSupported = [...supportedImages, ...supportedDocs];
  
  if (!allSupported.includes(m)) {
    console.warn("[analyze-material] Unsupported MIME type, defaulting to image/jpeg:", m);
    return "image/jpeg";
  }
  return m;
}

async function analyzeWithAI(
  imageBase64: string,
  mimeType: string,
  fileName: string | undefined,
  apiKey: string
): Promise<AnalysisResponse> {
  const isPDF = mimeType === "application/pdf";
  
  const prompt = `You are Sage, an AI assistant for StudySwap. Analyze this study material${isPDF ? " (PDF document)" : " image"} and provide:

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
   - "Google Classroom Image Link" ❌
   - "Protein Structure and Membrane Dynamics" ❌
   - "Study Materials" ❌

2. A brief description of what's in the material (max 150 characters)
3. The most appropriate subject (choose from: Math, Science, English, History, Foreign Language, Computer Science, Business, Art, Music, Other)
4. The material type (choose from: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay, Other)

CRITICAL INSTRUCTIONS:
- Your title MUST ALWAYS follow the format [Class Name] [Type of Material] ([Topic]).
- Do NOT generate generic titles like "Google Classroom" or "Document".
- Extract the actual content/subject from the material and use it to create a meaningful title.
- If the material shows a classroom link or screenshot, identify what subject/topic it relates to.
- Always infer the class name from context if possible.

Respond ONLY in valid JSON format (no markdown, no extra text):
{
  "title": "[Class Name] [Type of Material] ([Topic])",
  "description": "...",
  "subject": "...",
  "type": "..."
}`;

  console.log("[analyze-material] Analyzing", isPDF ? "PDF" : "image", "- Size:", imageBase64.length, "bytes");
  
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
    temperature: 0.2, // Very low temperature for strict format adherence
  };
  
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[analyze-material] AI Gateway error:", response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in AI response");
  }

  console.log("[analyze-material] AI Response:", content);
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  // STRICT VALIDATION AND ENFORCEMENT
  let title = parsed.title || "";
  const materialType = parsed.type || "Notes";
  const description = parsed.description || "";
  const subject = parsed.subject || "Other";
  
  // Regex to validate the exact format
  const titleRegex = /^[A-Za-z0-9\s]+\s+(Notes|Textbook|Practice Problems|Study Guide|Flashcards|Essay)\s*\([^)]+\)$/;
  
  if (!titleRegex.test(title)) {
    console.warn("[analyze-material] Title does not match format:", title);
    console.log("[analyze-material] Enforcing strict format...");
    
    // Extract class name from various sources
    let className = "Study Material";
    
    // Try to extract from description
    if (description.includes("AP ")) {
      const apMatch = description.match(/AP\s+([A-Za-z\s]+)/i);
      if (apMatch) className = apMatch[0].trim();
    } else if (description.includes("IB ")) {
      const ibMatch = description.match(/IB\s+([A-Za-z\s]+)/i);
      if (ibMatch) className = ibMatch[0].trim();
    } else if (subject && subject !== "Other") {
      // Use subject as fallback
      className = `${subject} 101`;
    }
    
    // Extract topic from the original title or description
    let topic = title;
    if (title.length > 50 || title.includes("Google") || title.includes("Classroom")) {
      // Title is too generic, extract from description
      const words = description.split(/[\s,\.]+/).filter(w => w.length > 3);
      topic = words.slice(0, 4).join(" ");
    }
    
    // Ensure we have meaningful content
    if (!topic || topic.length < 3) {
      topic = "Study Material";
    }
    
    title = `${className} ${materialType} (${topic})`;
    console.log("[analyze-material] Enforced title:", title);
  }
  
  return {
    title,
    description: description || "Study material content",
    subject: subject || "Other",
    type: materialType,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const body = await req.json();
    const { imageBase64, mimeType, fileName } = body as AnalysisRequest;

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const cleanedBase64 = validateBase64(imageBase64);
    const normalizedMimeType = normalizeMimeType(mimeType);
    
    const analysis = await analyzeWithAI(cleanedBase64, normalizedMimeType, fileName, apiKey);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[analyze-material] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Analysis failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
