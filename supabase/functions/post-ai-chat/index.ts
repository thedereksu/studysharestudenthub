import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-2.5-flash";
const VISION_MODEL = "google/gemini-2.5-flash";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RequestBody {
  materialId: string;
  message: string;
}

async function callGateway(apiKey: string, body: any): Promise<Response> {
  return await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Extract text from PDFs by sending the file as a data URL to a multimodal model
async function extractTextFromPDF(url: string, apiKey: string): Promise<string> {
  try {
    console.log("Extracting PDF via vision model:", url.slice(0, 80));
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Failed to fetch PDF:", resp.status);
      return "[PDF file - unable to fetch]";
    }
    const buffer = await resp.arrayBuffer();
    // Skip very large files (>15MB) to avoid token/size limits
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return "[PDF file - too large to process inline]";
    }
    const base64 = arrayBufferToBase64(buffer);
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: "Extract ALL text content from this PDF document verbatim. Preserve structure (headings, lists, paragraphs). Include any equations, captions, or table contents. Be thorough.",
            },
          ],
        },
      ],
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("PDF extraction gateway error:", aiResp.status, t.slice(0, 200));
      return "[PDF file - extraction failed]";
    }
    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content;
    return (content || "[PDF file - no content extracted]").slice(0, 15000);
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "[PDF file - extraction failed]";
  }
}

// Vision-based image content extraction
async function extractTextFromImage(url: string, apiKey: string): Promise<string> {
  try {
    console.log("Extracting image via vision model:", url.slice(0, 80));
    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url } },
            {
              type: "text",
              text: "Extract and describe all text, diagrams, charts, equations, and important information from this image. Be thorough and clear.",
            },
          ],
        },
      ],
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("Image extraction gateway error:", aiResp.status, t.slice(0, 200));
      return "[Image - extraction failed]";
    }
    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content;
    return content || "[Image - no content extracted]";
  } catch (err) {
    console.error("Image OCR error:", err);
    return "[Image - extraction failed]";
  }
}

async function extractTextFromPlainText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "[Text file - unable to read]";
    const text = await response.text();
    return text.slice(0, 10000);
  } catch (err) {
    console.error("Text file extraction error:", err);
    return "[Text file - extraction failed]";
  }
}

async function extractTextFromFile(
  url: string,
  fileType: string,
  apiKey: string
): Promise<string> {
  try {
    console.log("Extracting:", { url: url.slice(0, 50), fileType });
    if (fileType.startsWith("image/")) return await extractTextFromImage(url, apiKey);
    if (fileType.includes("pdf")) return await extractTextFromPDF(url, apiKey);
    if (
      fileType.includes("text") ||
      fileType.includes("plain") ||
      fileType.includes("markdown") ||
      fileType.includes("json") ||
      fileType.includes("xml")
    ) {
      return await extractTextFromPlainText(url);
    }
    if (fileType.includes("word") || fileType.includes("document")) {
      return "[Word document - extraction not supported]";
    }
    return "[File type - unable to extract content]";
  } catch (err) {
    console.error("File extraction error:", err);
    return "[File - extraction failed]";
  }
}

async function getOrCreateConversation(
  supabaseAdmin: any,
  materialId: string,
  userId: string
): Promise<ChatMessage[]> {
  try {
    const { data } = await supabaseAdmin
      .from("post_ai_conversations")
      .select("messages")
      .eq("material_id", materialId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.messages as ChatMessage[]) || [];
  } catch (err) {
    console.error("Error loading conversation:", err);
    return [];
  }
}

async function saveConversation(
  supabaseAdmin: any,
  materialId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("post_ai_conversations")
      .select("id")
      .eq("material_id", materialId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("post_ai_conversations")
        .update({ messages, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("post_ai_conversations")
        .insert({ material_id: materialId, user_id: userId, messages });
    }
  } catch (err) {
    console.error("Error saving conversation:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceKey || !lovableApiKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as RequestBody;
    const { materialId, message } = body;

    if (!materialId || !message) {
      return new Response(
        JSON.stringify({ error: "materialId and message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const anonKey =
          Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
        if (anonKey) {
          const supabaseAuth = createClient(supabaseUrl, anonKey);
          const {
            data: { user },
          } = await supabaseAuth.auth.getUser(token);
          userId = user?.id ?? null;
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch material
    const { data: material, error: matError } = await supabaseAdmin
      .from("materials")
      .select(
        "id, title, subject, type, description, exchange_type, uploader_id, file_url, file_type, files"
      )
      .eq("id", materialId)
      .single();

    if (matError || !material) {
      console.error("Material fetch error:", matError);
      return new Response(JSON.stringify({ error: "Material not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check access
    const isFree = material.exchange_type === "Free";
    const isOwner = userId === material.uploader_id;
    let hasUnlocked = false;

    if (!isOwner && !isFree) {
      const { data: unlock } = await supabaseAdmin
        .from("unlocks")
        .select("id")
        .eq("user_id", userId)
        .eq("material_id", materialId)
        .maybeSingle();
      hasUnlocked = !!unlock;
    }

    if (!(isFree || isOwner || hasUnlocked)) {
      return new Response(
        JSON.stringify({ error: "You do not have access to this material" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let messages = await getOrCreateConversation(supabaseAdmin, materialId, userId);

    // Build file context — cache extractions to avoid re-running on every chat turn
    const files: any[] =
      Array.isArray(material.files) && material.files.length > 0
        ? material.files
        : material.file_url
        ? [
            {
              file_url: material.file_url,
              file_type: material.file_type,
              file_name: material.title,
            },
          ]
        : [];

    let fileContext = "";
    for (const file of files) {
      if (!file.file_url || !file.file_name) continue;
      const cacheKey = `${materialId}:${file.file_url}`;

      // Try cache
      const { data: cached } = await supabaseAdmin
        .from("post_ai_file_cache")
        .select("extracted_text")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      let extractedText: string;
      if (cached?.extracted_text) {
        console.log("Using cached extraction for:", file.file_name);
        extractedText = cached.extracted_text;
      } else {
        extractedText = await extractTextFromFile(
          file.file_url,
          file.file_type || "",
          lovableApiKey
        );
        // Save to cache (best-effort)
        try {
          await supabaseAdmin.from("post_ai_file_cache").insert({
            cache_key: cacheKey,
            material_id: materialId,
            file_url: file.file_url,
            extracted_text: extractedText,
          });
        } catch (e) {
          console.error("Cache write failed:", e);
        }
      }

      fileContext += `\n\n[File: ${file.file_name}]\n${extractedText}`;
    }

    messages.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = `You are a helpful AI tutor assistant for a study material sharing platform.
You are helping a student understand the following study material:

Title: ${material.title}
Subject: ${material.subject}
Type: ${material.type}
Description: ${material.description || "No description provided"}

${fileContext ? `\nAttached Files Content:\n${fileContext}` : "No files attached"}

Please answer questions about this material clearly and helpfully. Use the attached file content to provide accurate, detailed answers. If the student asks something unrelated to the material, politely redirect them back to the topic.`;

    console.log("Calling Lovable AI Gateway, prompt length:", systemPrompt.length);
    const aiResp = await callGateway(lovableApiKey, {
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Please add funds to your Lovable AI workspace.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t.slice(0, 300));
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const assistantMessage =
      aiData.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    messages.push({
      role: "assistant",
      content: assistantMessage,
      timestamp: new Date().toISOString(),
    });

    await saveConversation(supabaseAdmin, materialId, userId, messages);

    return new Response(
      JSON.stringify({ success: true, message: assistantMessage, conversationId: materialId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("post-ai-chat error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Failed to process your request", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
