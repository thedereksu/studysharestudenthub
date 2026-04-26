/**
 * ⚠️ CRITICAL: DO NOT MODIFY THIS FUNCTION'S CORE LOGIC
 * This Edge Function uses the Lovable AI Gateway (Gemini 2.5 Flash) with Service Role Key
 * for secure file access. Any changes must preserve:
 * 1. Service Role Key usage for DIRECT STORAGE DOWNLOADS
 * 2. File extraction logic for PDFs, images, and text
 * 3. Conversation storage in post_ai_conversations table
 * 
 * If you need to update this, contact the development team.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ⚠️ DO NOT CHANGE: Lovable Gateway Configuration
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
}

// ⚠️ DO NOT CHANGE: Gateway API call wrapper
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

// ⚠️ DO NOT CHANGE: Base64 conversion for PDFs
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ⚠️ DO NOT CHANGE: Direct Storage Downloader
async function downloadFileFromStorage(
  url: string,
  fileName: string,
  supabaseAdmin: any
): Promise<ArrayBuffer | null> {
  try {
    console.log("Downloading file directly from storage:", fileName);
    
    // Extract storage path from URL
    let storagePath = null;
    const match = url.match(/\/storage\/v1\/object\/(?:public|private)\/materials\/(.+?)(?:\?|$)/);
    if (match) {
      storagePath = match[1];
    } else {
      // Fallback: try to find anything after 'materials/'
      const fallbackMatch = url.match(/materials\/(.+?)(?:\?|$)/);
      if (fallbackMatch) storagePath = fallbackMatch[1];
    }

    if (storagePath) {
      console.log("Extracted storage path for download:", storagePath);
      const { data, error } = await supabaseAdmin.storage
        .from("materials")
        .download(storagePath);
      
      if (error) {
        console.error("Direct download error:", error);
      } else if (data) {
        const buffer = await data.arrayBuffer();
        console.log("Successfully downloaded file directly:", fileName, "size:", buffer.byteLength);
        return buffer;
      }
    }

    // Fallback: Try signed URL fetch if direct download fails
    console.log("Direct download failed or path not found, trying signed URL fallback");
    const { data: signedData } = await supabaseAdmin.storage
      .from("materials")
      .createSignedUrl(storagePath || fileName, 3600);
    
    if (signedData?.signedUrl) {
      const resp = await fetch(signedData.signedUrl);
      if (resp.ok) return await resp.arrayBuffer();
    }

    return null;
  } catch (err) {
    console.error("Download wrapper error:", err);
    return null;
  }
}

// ⚠️ DO NOT CHANGE: PDF extraction
async function extractTextFromPDF(
  url: string,
  fileName: string,
  apiKey: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    const buffer = await downloadFileFromStorage(url, fileName, supabaseAdmin);
    if (!buffer) return "[PDF file - unable to fetch]";
    
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
              text: "Extract ALL text content from this PDF document verbatim. Preserve structure (headings, lists, paragraphs). Include any equations, captions, or table contents. Be thorough and complete. Return the extracted text as plain text.",
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    if (!aiResp.ok) return "[PDF file - extraction failed]";
    const data = await aiResp.json();
    return data.choices?.[0]?.message?.content || "[PDF file - no content extracted]";
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "[PDF file - extraction failed]";
  }
}

// ⚠️ DO NOT CHANGE: Image extraction
async function extractTextFromImage(
  url: string,
  fileName: string,
  apiKey: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    const buffer = await downloadFileFromStorage(url, fileName, supabaseAdmin);
    if (!buffer) return "[Image - unable to fetch]";
    
    const base64 = arrayBufferToBase64(buffer);
    const mimeType = url.includes(".png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: "Extract and describe all text, diagrams, charts, equations, graphs, and important visual information from this image. Be thorough, detailed, and clear.",
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    if (!aiResp.ok) return "[Image - extraction failed]";
    const data = await aiResp.json();
    return data.choices?.[0]?.message?.content || "[Image - no content extracted]";
  } catch (err) {
    console.error("Image OCR error:", err);
    return "[Image - extraction failed]";
  }
}

// ⚠️ DO NOT CHANGE: Plain text extraction
async function extractTextFromPlainText(
  url: string,
  fileName: string,
  supabaseAdmin: any
): Promise<string> {
  try {
    const buffer = await downloadFileFromStorage(url, fileName, supabaseAdmin);
    if (!buffer) return "[Text file - unable to read]";
    return new TextDecoder().decode(buffer).slice(0, 15000);
  } catch (err) {
    console.error("Text file extraction error:", err);
    return "[Text file - extraction failed]";
  }
}

// ⚠️ DO NOT CHANGE: Main file extraction dispatcher
async function extractTextFromFile(
  url: string,
  fileType: string,
  fileName: string,
  apiKey: string,
  supabaseAdmin: any
): Promise<string> {
  if (fileType.startsWith("image/")) return await extractTextFromImage(url, fileName, apiKey, supabaseAdmin);
  if (fileType.includes("pdf")) return await extractTextFromPDF(url, fileName, apiKey, supabaseAdmin);
  if (fileType.includes("text") || fileType.includes("plain") || fileType.includes("markdown")) {
    return await extractTextFromPlainText(url, fileName, supabaseAdmin);
  }
  return "[File type - unable to extract content]";
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as RequestBody;
    const { materialId, message } = body;

    if (!materialId || !message) {
      return new Response(JSON.stringify({ error: "materialId and message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch material
    const { data: material, error: matError } = await supabaseAdmin
      .from("materials")
      .select("id, title, subject, type, description, exchange_type, uploader_id, file_url, file_type, files")
      .eq("id", materialId)
      .single();

    if (matError || !material) {
      return new Response(JSON.stringify({ error: "Material not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Access Check
    const isFree = material.exchange_type === "Free";
    const isOwner = userId === material.uploader_id;
    let hasUnlocked = false;
    if (!isOwner && !isFree) {
      const { data: unlock } = await supabaseAdmin.from("unlocks").select("id").eq("user_id", userId).eq("material_id", materialId).maybeSingle();
      hasUnlocked = !!unlock;
    }

    if (!(isFree || isOwner || hasUnlocked)) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let messages = await getOrCreateConversation(supabaseAdmin, materialId, userId);

    // Build file context
    const files: any[] = Array.isArray(material.files) && material.files.length > 0 ? material.files : material.file_url ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }] : [];

    let fileContext = "";
    for (const file of files) {
      if (!file.file_url || !file.file_name) continue;
      const extractedText = await extractTextFromFile(file.file_url, file.file_type || "", file.file_name, lovableApiKey, supabaseAdmin);
      fileContext += `\n\n═══════════════════════════════════════\nFILE: ${file.file_name}\n═══════════════════════════════════════\n${extractedText}\n═══════════════════════════════════════\n`;
    }

    messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

    const systemPrompt = `You are a helpful AI tutor for a study material sharing platform.
Material: ${material.title} (${material.subject})
Description: ${material.description || "N/A"}

${fileContext ? `✓ ATTACHED FILE CONTENT:\n${fileContext}\n\n✓ You HAVE access to the file content above. Use it to answer questions accurately.` : "✗ No files attached."}

INSTRUCTIONS:
1. You CAN read the file content provided above.
2. Use it to answer questions accurately.
3. Do NOT say you cannot access files.`;

    const response = await callGateway(lovableApiKey, {
      model: VISION_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      max_tokens: 2048,
      temperature: 0.7,
    });

    if (!response.ok) throw new Error(`Gateway error: ${response.status}`);
    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    messages.push({ role: "assistant", content: assistantMessage, timestamp: new Date().toISOString() });
    await saveConversation(supabaseAdmin, materialId, userId, messages);

    return new Response(JSON.stringify({ success: true, message: assistantMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("post-ai-chat error:", err);
    return new Response(JSON.stringify({ error: "Failed to process request", details: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
