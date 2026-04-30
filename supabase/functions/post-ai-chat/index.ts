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
              text: "You are a document extraction specialist. CRITICAL TASK: Extract EVERY SINGLE PAGE or SLIDE from this file, from first to last. Do NOT truncate, summarize, or skip any content. Process the entire document completely. For each page/slide, use the format '=== Page/Slide [N] ===' and include: all text, bullet points, headers, captions, tables, lists, diagrams, and image descriptions. If there are 100 slides, extract all 100. If there are 500 pages, extract all 500. Be thorough and complete. Return the FULL extracted content without any omissions.",
            },
          ],
        },
      ],
      max_tokens: 32000,
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

(System Note: You have the complete content above. Use it to answer. Do not say you cannot read the files or that content is missing.)`;

    const systemPrompt = `You are a helpful AI tutor named Sage for the material: "${material.title}".
The user is asking questions about study material they uploaded. 
You have been provided with the COMPLETE text content of the material directly in the user's message context.

IMPORTANT: You have access to a "web_search" tool that performs real-time internet searches.
- For material-specific questions, use the attached file content above as your primary source.
- If the user's question requires information NOT found in the attached files (current events, external facts, definitions, broader context, recent updates, or any topic beyond the material), you MUST call the web_search tool to retrieve up-to-date information before answering.
- You may call web_search multiple times with different queries if needed.
- After searching, synthesize the results into a clear answer and cite source URLs inline when relevant.

Keep responses concise, well-formatted using markdown, and always maintain your helpful, academic personality.`;

    // Web search tool definition (executed via DuckDuckGo HTML — no API key required)
    const tools = [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Search the public internet for up-to-date information on any topic. Use this whenever the user asks about something not contained in the attached material, or when current/external facts are needed.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query. Be specific and concise.",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      },
    ];

    async function performWebSearch(query: string): Promise<string> {
      try {
        console.log(`[AI Chat] web_search: ${query}`);
        const resp = await fetch(
          `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; StudySwapBot/1.0)" } }
        );
        if (!resp.ok) return `Search failed with status ${resp.status}`;
        const html = await resp.text();
        const results: { title: string; url: string; snippet: string }[] = [];
        const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = resultRegex.exec(html)) !== null && results.length < 6) {
          const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
          let url = m[1];
          // DuckDuckGo wraps URLs in /l/?uddg=...
          const uddg = url.match(/[?&]uddg=([^&]+)/);
          if (uddg) url = decodeURIComponent(uddg[1]);
          results.push({ url, title: stripTags(m[2]), snippet: stripTags(m[3]) });
        }
        if (results.length === 0) return "No results found.";
        return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
      } catch (err) {
        console.error("[AI Chat] web_search error:", err);
        return `Search error: ${String(err)}`;
      }
    }

    // 3. AI Call with tool-calling loop (max 4 iterations)
    const conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: injectedMessage },
    ];

    let assistantMessage = "I couldn't generate a response.";
    for (let iter = 0; iter < 4; iter++) {
      const response = await callGateway(lovableApiKey, {
        model: VISION_MODEL,
        messages: conversationMessages,
        tools,
        max_tokens: 8192,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Gateway Error: ${err}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Append assistant message with tool calls
        conversationMessages.push(msg);
        // Execute each tool call
        for (const call of toolCalls) {
          if (call.function?.name === "web_search") {
            let args: any = {};
            try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* noop */ }
            const result = await performWebSearch(args.query || "");
            conversationMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: result,
            });
          } else {
            conversationMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: "Unknown tool",
            });
          }
        }
        // Loop again so the model can use the tool results
        continue;
      }

      assistantMessage = msg.content || assistantMessage;
      break;
    }

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
