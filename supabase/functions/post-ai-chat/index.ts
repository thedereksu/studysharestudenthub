import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { OpenAI } from "https://esm.sh/openai@1.41.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RequestBody {
  materialId: string;
  message: string;
}

async function extractTextFromFile(url: string, fileType: string): Promise<string> {
  try {
    if (fileType.startsWith("image/")) return "[Image file - visual content present]";
    if (fileType.includes("pdf")) return "[PDF file - content extraction requires external service]";
    if (fileType.includes("text") || fileType.includes("plain")) {
      const response = await fetch(url);
      if (response.ok) return (await response.text()).slice(0, 10000);
    }
    return "[File content unavailable]";
  } catch (err) {
    console.error("File extraction error:", err);
    return "[Failed to extract file content]";
  }
}

async function getOrCreateConversation(supabaseAdmin: any, materialId: string, userId: string): Promise<ChatMessage[]> {
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

async function saveConversation(supabaseAdmin: any, materialId: string, userId: string, messages: ChatMessage[]): Promise<void> {
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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !serviceKey || !openaiApiKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const body = await req.json() as RequestBody;
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
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
        if (anonKey) {
          const supabaseAuth = createClient(supabaseUrl, anonKey);
          const { data: { user } } = await supabaseAuth.auth.getUser(token);
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
      .select("id, title, subject, type, description, exchange_type, uploader_id, file_url, file_type, files")
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

    // Build file context
    let fileContext = "";
    const files = Array.isArray(material.files) && material.files.length > 0
      ? material.files
      : material.file_url
        ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }]
        : [];

    for (const file of files) {
      if (file.file_url && file.file_name) {
        const extractedText = await extractTextFromFile(file.file_url, file.file_type || "");
        fileContext += `\n\n[File: ${file.file_name}]\n${extractedText}`;
      }
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

Please answer questions about this material clearly and helpfully. If the student asks something unrelated to the material, politely redirect them back to the topic.`;

    // Call OpenAI (or Lovable Gateway emulating OpenAI)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use a standard model name
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

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
