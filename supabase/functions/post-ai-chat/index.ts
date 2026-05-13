/**
 * ⚠️ CRITICAL: DO NOT MODIFY THIS FUNCTION'S CORE LOGIC
 * This Edge Function uses the Lovable AI Gateway (Gemini 2.5 Flash) with Service Role Key
 * for secure file access. Any changes must preserve:
 * 1. Service Role Key usage for DIRECT STORAGE DOWNLOADS
 * 2. DIRECT MESSAGE INJECTION (Injecting file content into the user message)
 * 3. Conversation storage in post_ai_conversations table
 * 4. Multi-modal support for user-attached files (images, PDFs, text)
 * 5. Streaming responses for real-time chat experience.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-flash";



interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AttachmentData {
  name: string;
  type: string;
  data: string; // base64 or data URL
}

interface RequestBody {
  materialId: string;
  message: string;
  frontendContext?: string;
  history?: any[];
  attachments?: AttachmentData[];
}

async function callGateway(apiKey: string, body: any, stream: boolean = false): Promise<Response> {
  const requestBody = { ...body, stream };
  return await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
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
    const { materialId, message, frontendContext, history, attachments } = body;
    let visionInputs: any[] = [];

    // Auth
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // 0. Credit Check and Deduction
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits, last_credit_refresh")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[AI Chat] Error fetching user profile:", profileError);
      return new Response(JSON.stringify({ error: "User profile not found" }), { status: 404, headers: corsHeaders });
    }

    let currentCredits = profile.credits;
    let lastRefresh = new Date(profile.last_credit_refresh);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Refresh daily credits if a new day has passed since last refresh
    if (lastRefresh < today) {
      currentCredits = Math.min(currentCredits + 5, 50); // Add 5 daily, cap at 50 for example
      lastRefresh = today;
      await supabaseAdmin
        .from("profiles")
        .update({ credits: currentCredits, last_credit_refresh: lastRefresh.toISOString().split('T')[0] })
        .eq("id", userId);
    }

    if (currentCredits < 1) {
      return new Response(JSON.stringify({ error: "Insufficient credits to use Sage AI. Post a material to earn more!" }), { status: 402, headers: corsHeaders });
    }

    // Determine credits to deduct
    let creditsToDeduct = 1;
    if (attachments && attachments.length > 0) {
      creditsToDeduct = 2; // More credits for multi-modal prompts
    }

    if (currentCredits < creditsToDeduct) {
      return new Response(JSON.stringify({ error: "Insufficient credits to use Sage AI with attachments. Post a material to earn more!" }), { status: 402, headers: corsHeaders });
    }

    currentCredits -= creditsToDeduct;
    await supabaseAdmin
      .from("profiles")
      .update({ credits: currentCredits })
      .eq("id", userId);

    // Pass current credits to the frontend for display
    const responseHeaders = { ...corsHeaders, "X-Current-Credits": currentCredits.toString() };


    // Get Material
    const { data: material } = await supabaseAdmin
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (!material) return new Response(JSON.stringify({ error: "Material not found" }), { status: 404, headers: responseHeaders });

    const systemPrompt = `You are a helpful AI tutor named Sage for the material: "${material.title}".\nThe user is asking questions about study material they uploaded. \nYou have been provided with the COMPLETE text content of the material directly in the user\\'s message context.\n\nIMPORTANT: You have access to a "web_search" tool that performs real-time internet searches.\n- For material-specific questions, use the attached file content above as your primary source.\n- If the user\\'s question requires information NOT found in the attached files (current events, external facts, definitions, broader context, recent updates, or any topic beyond the material), you MUST call the web_search tool to retrieve up-to-date information before answering.\n- You may call web_search multiple times with different queries if needed.\n- After searching, synthesize the results into a clear answer and cite source URLs inline when relevant.\n\nKeep responses concise, well-formatted using markdown, and always maintain your helpful, academic personality.`;

    // Web search tool definition (executed via DuckDuckGo HTML — no API key required)
    const tools = [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Search the web for current information or facts.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query.",
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    // 1. Context Collection
    let fileContent = frontendContext || "";
    
    // Process user-attached files (multi-modal)
    if (attachments && attachments.length > 0) {
      console.log(`[AI Chat] Processing ${attachments.length} user attachments...`);
      for (const att of attachments) {
        try {
          if (att.type.startsWith("image/") || att.type === "application/pdf") {
            // For images and PDFs, we\'ll convert them to data URLs for vision input
            // The frontend sends data URLs directly, so we just use att.data
            visionInputs.push({ type: "image_url", image_url: { url: att.data } });
            // Do not add to fileContent, as it\'s handled by visionInputs         } else if (att.type.startsWith("text/") || att.name.endsWith(".txt")) {
            // For text files, decode and include
            const textContent = atob(att.data.split(",")[1] || att.data);
            fileContent += `\n--- ATTACHMENT: ${att.name} ---\n${textContent}\n`;
          } else {
            fileContent += `\n--- ATTACHMENT: ${att.name} (${att.type}) ---\n[File attached]\n`;
          }
        } catch (err) {
          console.error(`[AI Chat] Error processing attachment ${att.name}:`, err);
        }
      }
    }
    
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

    // Prepare content for the AI model
    const aiContent: any[] = [];

    // Add text context first
    if (fileContent) {
      aiContent.push({ type: "text", text: `CONTEXT FROM ATTACHED MATERIALS:\n${fileContent}\n` });
    }

    // Add user\'s message
    aiContent.push({ type: "text", text: `USER QUESTION:\n${message}\n` });

    // Add vision inputs (images/PDFs from attachments)
    for (const visionInput of visionInputs) {
      aiContent.push(visionInput);
    }

    // Add system note
    aiContent.push({ type: "text", text: "(System Note: You have the complete content above. Use it to answer the user\'s question. Be concise and helpful.)" });

    // Construct the messages array for the AI gateway
    const gatewayMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: aiContent },
    ];

    // Call AI Gateway
    const aiResp = await callGateway(lovableApiKey, {
      model: VISION_MODEL,
      messages: gatewayMessages,
      tools: tools,
      max_tokens: 8192,
    }, true); // StreamDeno.serve(async (req) => {type: "string",
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
          const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '\"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
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
    // Build user message with vision content if attachments are present
    let userMessageContent: any = injectedMessage;
    if (attachments && attachments.length > 0) {
      const contentArray: any[] = [{ type: "text", text: injectedMessage }];
      
      for (const att of attachments) {
        try {
          if (att.type.startsWith("image/")) {
            // Ensure data URL format
            const dataUrl = att.data.startsWith("data:") ? att.data : `data:${att.type};base64,${att.data}`;
            contentArray.push({
              type: "image_url",
              image_url: { url: dataUrl },
            });
            console.log(`[AI Chat] Added image attachment: ${att.name}`);
          } else if (att.type === "application/pdf") {
            // PDFs can also be passed as image_url if they're single page or first page
            const dataUrl = att.data.startsWith("data:") ? att.data : `data:${att.type};base64,${att.data}`;
            contentArray.push({
              type: "image_url",
              image_url: { url: dataUrl },
            });
            console.log(`[AI Chat] Added PDF attachment: ${att.name}`);
          }
        } catch (err) {
          console.error(`[AI Chat] Error adding attachment to vision content:`, err);
        }
      }
      
      if (contentArray.length > 1) {
        userMessageContent = contentArray;
      }
    }
    
    const conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessageContent },
    ];

    let assistantMessage = "";
    let toolCallOccurred = false;

    for (let iter = 0; iter < 4; iter++) {
      const response = await callGateway(lovableApiKey, {
        model: VISION_MODEL,
        messages: conversationMessages,
        tools,
        max_tokens: 8192,
      }, true); // Request streaming

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI Gateway Error: ${err}`);
      }

      if (!response.body) {
        throw new Error("No response body from AI Gateway");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolCalls: any[] = [];
      let messageContentBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        let lastIndex = 0;
        let nextIndex = buffer.indexOf('data: ');
        while (nextIndex !== -1) {
          const sseMessage = buffer.substring(lastIndex, nextIndex);
          if (sseMessage.trim().length > 0) {
            try {
              const json = JSON.parse(sseMessage.replace('data: ', ''));
              const choice = json.choices?.[0];
              const delta = choice?.delta;

              if (delta?.tool_calls && delta.tool_calls.length > 0) {
                toolCallOccurred = true;
                currentToolCalls.push(...delta.tool_calls);
              } else if (delta?.content) {
                messageContentBuffer += delta.content;
              }
            } catch (e) {
              console.warn("Failed to parse SSE chunk:", sseMessage, e);
            }
          }
          lastIndex = nextIndex + 'data: '.length;
          nextIndex = buffer.indexOf('data: ', lastIndex);
        }
        buffer = buffer.substring(lastIndex);
      }

      // Process any remaining buffer content
      if (buffer.trim().length > 0) {
        try {
          const json = JSON.parse(buffer.replace('data: ', ''));
          const choice = json.choices?.[0];
          const delta = choice?.delta;

          if (delta?.tool_calls && delta.tool_calls.length > 0) {
            toolCallOccurred = true;
            currentToolCalls.push(...delta.tool_calls);
          } else if (delta?.content) {
            messageContentBuffer += delta.content;
          }
        } catch (e) {
          console.warn("Failed to parse final SSE chunk:", buffer, e);
        }
      }

      assistantMessage = messageContentBuffer;

      if (toolCallOccurred && currentToolCalls.length > 0) {
        conversationMessages.push({ role: "assistant", content: assistantMessage, tool_calls: currentToolCalls });
        for (const call of currentToolCalls) {
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
        // Reset for next iteration
        toolCallOccurred = false;
        currentToolCalls = [];
        assistantMessage = "";
        continue; // Loop again so the model can use the tool results
      } else {
        break; // No tool calls or content received, exit loop
      }
    }

    // Save conversation history (only the final assistant message)
    const updatedMessages = [...history || [], { role: "user", content: message }, { role: "assistant", content: assistantMessage }];
    await supabaseAdmin.from("post_ai_conversations").upsert({
      material_id: materialId,
      user_id: userId,
      messages: updatedMessages as any,
      updated_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify(analysis), {
      headers: responseHeaders,
    });

  } catch (err) {
    console.error("[AI Chat] Critical Error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
