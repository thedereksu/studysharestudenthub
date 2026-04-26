import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import OpenAI from "npm:openai@4.69.0";

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

// Extract text from PDF using a simple approach
async function extractTextFromPDF(url: string): Promise<string> {
  try {
    console.log("Attempting to extract text from PDF:", url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch PDF:", response.status);
      return "[PDF file - unable to extract text]";
    }
    
    // For Deno environment, we can use a simple text extraction approach
    // In production, consider using a library like pdf-parse or calling an external service
    const buffer = await response.arrayBuffer();
    
    // Simple heuristic: search for text patterns in PDF
    const text = new TextDecoder().decode(buffer);
    const matches = text.match(/BT[\s\S]*?ET/g) || [];
    
    if (matches.length > 0) {
      // Extract readable text from PDF operators
      let extractedText = "";
      for (const match of matches.slice(0, 50)) { // Limit to first 50 text blocks
        const textMatch = match.match(/\((.*?)\)/);
        if (textMatch) {
          extractedText += textMatch[1] + " ";
        }
      }
      return extractedText.slice(0, 5000) || "[PDF file - text extraction limited]";
    }
    
    return "[PDF file - could not extract readable text]";
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "[PDF file - extraction failed]";
  }
}

// Extract text from images using OpenAI Vision API
async function extractTextFromImage(url: string, openai: OpenAI): Promise<string> {
  try {
    console.log("Attempting to extract text from image:", url);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url },
            },
            {
              type: "text",
              text: "Extract and describe all text, diagrams, charts, and important information from this image. Be thorough and clear.",
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    console.log("Image extraction successful");
    return content || "[Image - could not extract content]";
  } catch (err) {
    console.error("Image OCR error:", err);
    return "[Image - extraction failed]";
  }
}

// Extract text from plain text files
async function extractTextFromPlainText(url: string): Promise<string> {
  try {
    console.log("Attempting to extract text from plain text file:", url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to fetch text file:", response.status);
      return "[Text file - unable to read]";
    }
    const text = await response.text();
    return text.slice(0, 10000); // Limit to first 10k characters
  } catch (err) {
    console.error("Text file extraction error:", err);
    return "[Text file - extraction failed]";
  }
}

// Main file extraction dispatcher
async function extractTextFromFile(
  url: string,
  fileType: string,
  openai: OpenAI
): Promise<string> {
  try {
    console.log("Extracting text from file:", { url: url.slice(0, 50), fileType });
    
    // Image files
    if (fileType.startsWith("image/")) {
      return await extractTextFromImage(url, openai);
    }
    
    // PDF files
    if (fileType.includes("pdf")) {
      return await extractTextFromPDF(url);
    }
    
    // Plain text files
    if (
      fileType.includes("text") ||
      fileType.includes("plain") ||
      fileType.includes("markdown") ||
      fileType.includes("json") ||
      fileType.includes("xml")
    ) {
      return await extractTextFromPlainText(url);
    }
    
    // Word documents - note that extraction is limited without a library
    if (fileType.includes("word") || fileType.includes("document")) {
      return "[Word document - extraction requires external service]";
    }
    
    // Fallback
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
    console.log("Building file context for material:", materialId);
    let fileContext = "";
    const files = Array.isArray(material.files) && material.files.length > 0
      ? material.files
      : material.file_url
        ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }]
        : [];

    console.log("Files to process:", files.length);
    for (const file of files) {
      if (file.file_url && file.file_name) {
        console.log("Processing file:", file.file_name);
        const extractedText = await extractTextFromFile(
          file.file_url,
          file.file_type || "",
          openai
        );
        fileContext += `\n\n[File: ${file.file_name}]\n${extractedText}`;
      }
    }

    console.log("File context length:", fileContext.length);

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

    // Call OpenAI (or Lovable Gateway emulating OpenAI)
    console.log("Calling AI with system prompt length:", systemPrompt.length);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
