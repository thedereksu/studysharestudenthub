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
  history?: any[];
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

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  if (!url.startsWith("http")) return url;
  // Match /storage/v1/object/(public|sign|authenticated)/materials/<path>
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/materials\/(.+?)(?:\?.*)?$/);
  if (match) return decodeURIComponent(match[1]);
  // Fallback: anything after /materials/
  const fallback = url.match(/\/materials\/(.+?)(?:\?.*)?$/);
  return fallback ? decodeURIComponent(fallback[1]) : null;
}

async function downloadFileFromStorage(
  url: string,
  fileName: string,
  supabaseAdmin: any
): Promise<ArrayBuffer | null> {
  try {
    console.log(`[AI Chat] Downloading: ${fileName}`);
    const storagePath = extractStoragePath(url);
    if (!storagePath) {
      console.error(`[AI Chat] Could not extract storage path from: ${url}`);
      return null;
    }
    console.log(`[AI Chat] Extracted storage path: ${storagePath}`);
    const { data, error } = await supabaseAdmin.storage
      .from("materials")
      .download(storagePath);

    if (error || !data) {
      console.error(`[AI Chat] Download error for ${storagePath}:`, error);
      return null;
    }
    return await data.arrayBuffer();
  } catch (err) {
    console.error(`[AI Chat] Download exception:`, err);
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
    const mimeType = fileType || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`[AI Chat] Calling Vision API for ${fileName}...`);
    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: "You are a document extractor. Extract ALL text content from this file VERBATIM and IN FULL. Process EVERY SINGLE PAGE or SLIDE from beginning to end — do not stop early, do not summarize, do not skip pages. For each page/slide, prefix with '=== Page/Slide N ===' and include all text, bullet points, captions, diagrams, tables, and image descriptions. If it's an image, perform full OCR and describe all visuals. Return ONLY the extracted content.",
            },
          ],
        },
      ],
      max_tokens: 16000,
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[AI Chat] Vision API error: ${errText}`);
      return `[File: ${fileName} - extraction failed]`;
    }
    
    const data = await aiResp.json();
    return data.choices?.[0]?.message?.content || `[File: ${fileName} - no content extracted]`;
  } catch (err) {
    console.error(`[AI Chat] Extraction exception:`, err);
    return `[File: ${fileName} - error processing]`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!supabaseUrl || !serviceKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: "Configuration missing" }), { status: 500, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const body = await req.json() as RequestBody;
    const { materialId, message, frontendContext, history } = body;

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // Get Material
    const { data: material } = await supabaseAdmin
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (!material) return new Response(JSON.stringify({ error: "Material not found" }), { status: 404, headers: corsHeaders });

    // 1. Context Collection
    let fileContent = frontendContext || "";
    
    // If context is short, attempt backend extraction
    if (fileContent.length < 200) {
      console.log(`[AI Chat] Insufficient context, attempting backend extraction...`);
      const files = Array.isArray(material.files) 
        ? material.files 
        : material.file_url 
          ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }] 
          : [];
      
      for (const file of files) {
        const text = await extractTextFromFile(file.file_url, file.file_type, file.file_name, lovableApiKey, supabaseAdmin);
        fileContent += `\n--- START FILE: ${file.file_name} ---\n${text}\n--- END FILE: ${file.file_name} ---\n`;
      }
    }

    // 2. Direct Message Injection
    const injectedMessage = `CONTEXT FROM ATTACHED MATERIALS:
${fileContent || "No detailed file content available."}

USER QUESTION:
${message}

(System Note: You have the content above. Use it to answer. Do not say you cannot read the files.)`;

    const systemPrompt = `You are a helpful AI tutor for the material: "${material.title}".
The user is asking questions about study material they uploaded. 
You have been provided with the actual text content of the material directly in the user's message context.
Use this content to provide detailed, accurate, and helpful summaries or answers.
Keep responses concise and well-formatted using markdown.`;

    // 3. AI Call
    const response = await callGateway(lovableApiKey, {
      model: VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: injectedMessage }
      ],
      max_tokens: 4096,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI Gateway Error: ${err}`);
    }
    
    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(JSON.stringify({ success: true, message: assistantMessage }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("[AI Chat] Critical Error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
