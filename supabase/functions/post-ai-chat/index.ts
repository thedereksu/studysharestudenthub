/**
 * ⚠️ CRITICAL: DO NOT MODIFY THIS FUNCTION'S CORE LOGIC
 * This Edge Function uses the Lovable AI Gateway (Gemini 2.5 Flash) with Service Role Key
 * for secure file access. Any changes must preserve:
 * 1. Service Role Key usage for DIRECT STORAGE DOWNLOADS
 * 2. DIRECT MESSAGE INJECTION (Injecting file content into the user message)
 * 3. Conversation storage in post_ai_conversations table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RequestBody {
  materialId: string;
  message: string;
  frontendContext?: string;
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

async function downloadFileFromStorage(
  url: string,
  fileName: string,
  supabaseAdmin: any
): Promise<ArrayBuffer | null> {
  try {
    console.log("Downloading file directly from storage:", fileName);
    let storagePath = null;
    const match = url.match(/\/storage\/v1\/object\/(?:public|private)\/materials\/(.+?)(?:\?|$)/);
    if (match) {
      storagePath = match[1];
    } else {
      const fallbackMatch = url.match(/materials\/(.+?)(?:\?|$)/);
      if (fallbackMatch) storagePath = fallbackMatch[1];
    }

    if (storagePath) {
      const { data, error } = await supabaseAdmin.storage
        .from("materials")
        .download(storagePath);
      
      if (!error && data) {
        return await data.arrayBuffer();
      }
    }
    return null;
  } catch (err) {
    console.error("Download error:", err);
    return null;
  }
}

async function extractTextFromFile(
  url: string,
  fileType: string,
  fileName: string,
  apiKey: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    const buffer = await downloadFileFromStorage(url, fileName, supabaseAdmin);
    if (!buffer) return `[File: ${fileName} - content unavailable]`;

    const base64 = arrayBufferToBase64(buffer);
    const mimeType = fileType || (url.includes(".pdf") ? "application/pdf" : "image/jpeg");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // We send the file to the vision model to extract text/content
    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: "You are a document extractor. Extract ALL text content from this file verbatim. If it's a PDF, read every page. If it's an image, describe everything and perform OCR. Return ONLY the extracted text content.",
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    if (!aiResp.ok) return `[File: ${fileName} - extraction failed]`;
    const data = await aiResp.json();
    return data.choices?.[0]?.message?.content || `[File: ${fileName} - no content extracted]`;
  } catch (err) {
    console.error("Extraction error:", err);
    return `[File: ${fileName} - error processing]`;
  }
}

async function getOrCreateConversation(
  supabaseAdmin: any,
  materialId: string,
  userId: string
): Promise<ChatMessage[]> {
  const { data } = await supabaseAdmin
    .from("post_ai_conversations")
    .select("messages")
    .eq("material_id", materialId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.messages as ChatMessage[]) || [];
}

async function saveConversation(
  supabaseAdmin: any,
  materialId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: "Config error" }), { status: 500, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const body = await req.json() as RequestBody;
    const { materialId, message, frontendContext } = body;

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: material } = await supabaseAdmin
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (!material) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

    let messages = await getOrCreateConversation(supabaseAdmin, materialId, userId);

    // Build file context
    let fileContent = frontendContext || "";
    
    // If frontend didn't provide enough context, try backend extraction
    if (fileContent.length < 100) {
      const files = Array.isArray(material.files) ? material.files : material.file_url ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }] : [];
      
      for (const file of files) {
        const text = await extractTextFromFile(file.file_url, file.file_type, file.file_name, lovableApiKey, supabaseAdmin);
        fileContent += `\n--- START FILE: ${file.file_name} ---\n${text}\n--- END FILE: ${file.file_name} ---\n`;
      }
    }

    // DIRECT MESSAGE INJECTION
    const injectedMessage = `CONTEXT FROM ATTACHED MATERIALS:
${fileContent || "No files attached."}

USER QUESTION:
${message}

(Note to AI: You HAVE the file content above. Use it to answer. Do not say you cannot read the files.)`;

    const systemPrompt = `You are a helpful AI tutor for the material: "${material.title}".
You have been provided with the actual text content of the material directly in the user's message context.
Use this content to provide detailed, accurate, and helpful summaries or answers.
If the content is missing or shows an error, politely inform the user, but prioritize the provided context.`;

    const response = await callGateway(lovableApiKey, {
      model: VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: injectedMessage }
      ],
      max_tokens: 2048,
    });

    if (!response.ok) throw new Error("Gateway error");
    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "No response generated.";

    // Save history
    messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });
    messages.push({ role: "assistant", content: assistantMessage, timestamp: new Date().toISOString() });
    await saveConversation(supabaseAdmin, materialId, userId, messages);

    return new Response(JSON.stringify({ success: true, message: assistantMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Error", details: String(err) }), { status: 500, headers: corsHeaders });
  }
});
