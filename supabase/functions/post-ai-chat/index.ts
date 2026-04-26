/**
 * ⚠️ CRITICAL: DO NOT MODIFY THIS FUNCTION'S CORE LOGIC
 * This Edge Function uses the Lovable AI Gateway (Gemini 2.5 Flash) with Service Role Key
 * for secure file access. Any changes must preserve:
 * 1. Service Role Key usage for generating signed URLs
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

// ⚠️ DO NOT CHANGE: PDF extraction using vision model with fallback
async function extractTextFromPDF(url: string, apiKey: string): Promise<string> {
  try {
    console.log("Extracting PDF via vision model");
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Failed to fetch PDF:", resp.status);
      return "[PDF file - unable to fetch]";
    }
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return "[PDF file - too large to process]";
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
              text: "Extract ALL text content from this PDF document verbatim. Preserve structure (headings, lists, paragraphs). Include any equations, captions, or table contents. Be thorough and complete. Return the extracted text as plain text.",
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    if (!aiResp.ok) {
      console.error("PDF extraction gateway error:", aiResp.status);
      return "[PDF file - extraction failed]";
    }
    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content || content.includes("cannot") || content.includes("unable")) {
      console.warn("PDF extraction returned error message:", content?.slice(0, 100));
      return "[PDF file - extraction failed]";
    }
    
    return (content || "[PDF file - no content extracted]").slice(0, 20000);
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "[PDF file - extraction failed]";
  }
}

// ⚠️ DO NOT CHANGE: Image extraction using vision model
async function extractTextFromImage(url: string, apiKey: string): Promise<string> {
  try {
    console.log("Extracting image via vision model");
    const aiResp = await callGateway(apiKey, {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url } },
            {
              type: "text",
              text: "Extract and describe all text, diagrams, charts, equations, graphs, and important visual information from this image. Be thorough, detailed, and clear.",
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    if (!aiResp.ok) {
      console.error("Image extraction gateway error:", aiResp.status);
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

// ⚠️ DO NOT CHANGE: Plain text extraction
async function extractTextFromPlainText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "[Text file - unable to read]";
    const text = await response.text();
    return text.slice(0, 15000);
  } catch (err) {
    console.error("Text file extraction error:", err);
    return "[Text file - extraction failed]";
  }
}

// ⚠️ DO NOT CHANGE: Main file extraction dispatcher
async function extractTextFromFile(
  url: string,
  fileType: string,
  apiKey: string
): Promise<string> {
  try {
    console.log("Extracting file:", { fileType });
    if (fileType.startsWith("image/")) return await extractTextFromImage(url, apiKey);
    if (fileType.includes("pdf")) return await extractTextFromPDF(url, apiKey);
    if (
      fileType.includes("text") ||
      fileType.includes("plain") ||
      fileType.includes("markdown") ||
      fileType.includes("json") ||
      fileType.includes("xml") ||
      fileType.includes("csv")
    ) {
      return await extractTextFromPlainText(url);
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

    // Build file context with fresh signed URLs
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
    console.log("Processing", files.length, "files for material:", materialId);
    
    for (const file of files) {
      if (!file.file_url || !file.file_name) continue;

      let accessUrl = file.file_url;
      
      // If URL is from Supabase storage, generate a fresh signed URL
      if (file.file_url.includes("supabase.co") && file.file_url.includes("/storage/")) {
        try {
          const pathMatch = file.file_url.match(/\/storage\/v1\/object\/(?:public|private)\/([^?]+)/);
          if (pathMatch) {
            const storagePath = pathMatch[1];
            const { data: signedData } = await supabaseAdmin.storage
              .from("materials")
              .createSignedUrl(storagePath, 3600); // 1 hour expiry
            
            if (signedData?.signedUrl) {
              accessUrl = signedData.signedUrl;
              console.log("Generated fresh signed URL for file:", file.file_name);
            }
          }
        } catch (err) {
          console.error("Failed to generate signed URL:", err);
        }
      }

      console.log("Extracting file:", file.file_name, "type:", file.file_type);
      const extractedText = await extractTextFromFile(
        accessUrl,
        file.file_type || "",
        lovableApiKey
      );
      
      // Add clear markers for file content
      fileContext += `\n\n═══════════════════════════════════════\n`;
      fileContext += `FILE: ${file.file_name}\n`;
      fileContext += `═══════════════════════════════════════\n`;
      fileContext += `${extractedText}\n`;
      fileContext += `═══════════════════════════════════════\n`;
    }

    console.log("Total file context length:", fileContext.length);

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

${fileContext ? `\n✓ ATTACHED FILE CONTENT (provided below):\n${fileContext}\n\n✓ You HAVE access to the file content above. Use it to answer questions accurately.` : "✗ No files attached to this material."}

IMPORTANT INSTRUCTIONS:
1. You CAN read and interpret the file content provided above.
2. You MUST use the file content to answer student questions accurately.
3. If the student asks about the material, refer to the file content provided.
4. Do NOT say you cannot access files - you have the content above.
5. Provide detailed, accurate answers based on the material provided.`;

    // Call Lovable Gateway
    console.log("Calling Lovable Gateway with file context length:", fileContext.length);
    const response = await callGateway(lovableApiKey, {
      model: VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gateway error:", response.status, errText.slice(0, 200));
      throw new Error(`Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

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
