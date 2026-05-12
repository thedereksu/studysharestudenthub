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
  const supportedText = ["text/plain"]; // Add text/plain support
  const allSupported = [...supportedImages, ...supportedDocs, ...supportedText];
  
  if (!allSupported.includes(m)) {
    console.warn("[analyze-material] Unsupported MIME type, defaulting to image/jpeg:", m);
    return "image/jpeg";
  }
  return m;
}

async function analyzeWithAI(
  fileBase64: string,
  mimeType: string,
  fileName: string | undefined,
  apiKey: string
): Promise<AnalysisResponse> {
  const isPDF = mimeType === "application/pdf";
  const isText = mimeType === "text/plain";

  let textContent: string | undefined;
  if (isText) {
    textContent = new TextDecoder().decode(Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0)));
    console.log("[analyze-material] Decoded text content length:", textContent.length);
  }
  
  const prompt = `You are Sage, an AI assistant for StudySwap. Analyze this study material${isPDF ? " (PDF document)" : isText ? " (text document)" : " (image)"} and provide:

1. A title MUST follow EXACTLY this format: [Class Name] [Type of Material] ([Topic])
   - CRITICAL: The format is MANDATORY and non-negotiable.
   - Replace [Class Name] with the course/class name (e.g., "AP World History", "Calculus II", "Biology 101")
   - Replace [Type of Material] with EXACTLY ONE of these: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay
   - Replace [Topic] with the specific topic covered (e.g., "Enlightenment", "Integration by Parts", "Protein Structure")
   
   CORRECT EXAMPLES (FOLLOW THIS PATTERN):
   - "AP World History Notes (Enlightenment)"
   - "Calculus II Practice Problems (Integration by Parts)"
   - "Biology 101 Study Guide (Protein Structure)"
   - "Chemistry AP Flashcards (Stoichiometry)"
   - "English 10 Essay (Brave New World Analysis)"
   - "Physics 201 Notes (Quantum Mechanics)"
   
   INCORRECT EXAMPLES (NEVER USE THESE FORMATS):
   - "Calculus II - Integration Techniques" ❌ (Missing type and wrong format)
   - "Google Classroom Image Link" ❌ (Too generic)
   - "Protein Structure and Membrane Dynamics" ❌ (Missing class name and type)
   - "Study Materials" ❌ (Too vague)
   - "Chapter 5" ❌ (Incomplete)

2. A brief description of what's in the material (max 150 characters)
3. The most appropriate subject (choose from: Math, Science, English, History, Foreign Language, Computer Science, Business, Art, Music, Other)
4. The material type (choose from: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay, Other)

CRITICAL INSTRUCTIONS:
- Your title MUST ALWAYS follow the exact format: [Class Name] [Type of Material] ([Topic])
- Do NOT deviate from this format under any circumstances.
- Do NOT use dashes, colons, or other separators instead of the required format.
- Extract the actual content/subject from the material and use it to create a meaningful title.
- If the material shows a classroom link or screenshot, identify what subject/topic it relates to.
- Always infer the class name from context if possible.
- The type of material MUST be one of: Notes, Textbook, Practice Problems, Study Guide, Flashcards, Essay

Respond ONLY in valid JSON format (no markdown, no extra text):
{
  "title": "[Class Name] [Type of Material] ([Topic])",
  "description": "...",
  "subject": "...",
  "type": "..."
}`;

  console.log("[analyze-material] Analyzing", isPDF ? "PDF" : "image", "- Size:", imageBase64.length, "bytes");
  
  const requestBody: any = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [],
      },
    ],
    max_tokens: 500,
    temperature: 0.2, // Very low temperature for strict format adherence
  };

  if (isText && textContent) {
    requestBody.messages[0].content.push({
      type: "text",
      text: `File Name: ${fileName || 'untitled'}\n\n${textContent}\n\n${prompt}`,
    });
  } else {
    requestBody.messages[0].content.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${fileBase64}`,
      },
    });
    requestBody.messages[0].content.push({
      type: "text",
      text: prompt,
    });
  }
  
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
  let materialType = parsed.type || "Notes";
  const description = parsed.description || "";
  const subject = parsed.subject || "Other";
  
  // Regex to validate the exact format: [Class Name] [Type] ([Topic])
  const titleRegex = /^[A-Za-z0-9\s]+\s+(Notes|Textbook|Practice Problems|Study Guide|Flashcards|Essay)\s*\([^)]+\)$/;
  
  if (!titleRegex.test(title)) {
    console.warn("[analyze-material] Title does not match format:", title);
    console.log("[analyze-material] Enforcing strict format...");
    
    // Extract components from the malformed title
    let className = "Study Material";
    let topic = "Study Material";
    
    // Try to extract class name from title or description
    if (title.includes("Calculus")) {
      className = "Calculus II";
    } else if (title.includes("Biology")) {
      className = "Biology 101";
    } else if (title.includes("History")) {
      className = "World History";
    } else if (description.includes("AP ")) {
      const apMatch = description.match(/AP\s+([A-Za-z\s]+)/i);
      if (apMatch) className = apMatch[0].trim();
    } else if (description.includes("IB ")) {
      const ibMatch = description.match(/IB\s+([A-Za-z\s]+)/i);
      if (ibMatch) className = ibMatch[0].trim();
    } else if (subject && subject !== "Other") {
      className = `${subject} 101`;
    }
    
    // Extract topic from the title or description
    // If title contains a dash, use the part after the dash as topic
    if (title.includes(" - ")) {
      topic = title.split(" - ").pop()?.trim() || topic;
    } else if (title.length > 0 && title.length < 100) {
      topic = title;
    } else {
      // Extract from description
      const words = description.split(/[\s,\.]+/).filter(w => w.length > 3);
      topic = words.slice(0, 4).join(" ");
    }
    
    // Ensure we have meaningful content
    if (!topic || topic.length < 3) {
      topic = "Study Material";
    }
    
    // Use the material type from AI response
    const validTypes = ["Notes", "Textbook", "Practice Problems", "Study Guide", "Flashcards", "Essay"];
    if (!validTypes.includes(materialType)) {
      materialType = "Notes";
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
    const { fileBase64, mimeType, fileName } = body as AnalysisRequest;

    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing fileBase64 or mimeType" }),
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

    const cleanedBase64 = validateBase64(fileBase64);
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
