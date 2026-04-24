import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OpenAI } from "https://esm.sh/openai@1";

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

async function extractTextFromPDF(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    // For now, return a placeholder. In production, use a PDF parsing library
    // or call an external service like AWS Textract or Google Document AI
    return "[PDF content - full extraction requires external service]";
  } catch (err) {
    console.error("PDF extraction error:", err);
    return "[Failed to extract PDF]";
  }
}

async function extractTextFromImage(url: string, openai: OpenAI): Promise<string> {
  try {
    // Use OpenAI Vision API to extract text from images
    const response = await openai.vision.create({
      model: "gpt-4-vision",
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
              text: "Extract all text and important information from this image. Format it clearly.",
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || "[No text extracted]";
  } catch (err) {
    console.error("Image OCR error:", err);
    return "[Failed to extract image text]";
  }
}

async function extractFileText(
  fileUrl: string,
  fileName: string,
  fileType: string,
  openai: OpenAI
): Promise<string> {
  if (fileType.includes("pdf")) {
    return await extractTextFromPDF(fileUrl);
  } else if (fileType.startsWith("image/")) {
    return await extractTextFromImage(fileUrl, openai);
  } else if (fileType.includes("text") || fileType.includes("plain")) {
    try {
      const response = await fetch(fileUrl);
      return await response.text();
    } catch (err) {
      console.error("Text file extraction error:", err);
      return "[Failed to extract text]";
    }
  }
  return "[Unsupported file type]";
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
      .insert({
        material_id: materialId,
        user_id: userId,
        messages,
      });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const { materialId, message } = (await req.json()) as RequestBody;

    if (!materialId || !message) {
      return new Response(
        JSON.stringify({ error: "materialId and message required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get authenticated user
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey =
        Deno.env.get("SUPABASE_ANON_KEY") ||
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const supabaseAuth = createClient(supabaseUrl, anonKey);
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch material and verify user can access it
    const { data: material, error: matError } = await supabaseAdmin
      .from("materials")
      .select("*, files")
      .eq("id", materialId)
      .single();

    if (matError || !material) {
      return new Response(JSON.stringify({ error: "Material not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFree = material.exchange_type === "Free";
    const isOwner = userId === material.uploader_id;
    let hasUnlocked = false;

    if (userId && !isOwner && !isFree) {
      const { data: unlock } = await supabaseAdmin
        .from("unlocks")
        .select("id")
        .eq("user_id", userId)
        .eq("material_id", materialId)
        .maybeSingle();
      hasUnlocked = !!unlock;
    }

    const canAccess = isFree || isOwner || hasUnlocked;
    if (!canAccess) {
      return new Response(
        JSON.stringify({ error: "You do not have access to this material" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get or create conversation
    let messages = await getOrCreateConversation(
      supabaseAdmin,
      materialId,
      userId
    );

    // Prepare file context (cached or freshly extracted)
    let fileContext = "";
    const files = (material.files as any[])?.length
      ? (material.files as any[])
      : [
          {
            file_url: material.file_url,
            file_type: material.file_type,
            file_name: material.title,
          },
        ];

      for (const file of files) {
      // Check cache first
      const { data: cached } = await supabaseAdmin
        .from("post_ai_file_cache")
        .select("extracted_text")
        .eq("material_id", materialId)
        .eq("file_name", file.file_name)
        .maybeSingle();

      if (cached) {
        fileContext += `\n\n[File: ${file.file_name}]\n${cached.extracted_text}`;
      } else if (file.file_url) {
        // Extract storage path from URL
        let finalUrl = file.file_url;
        const pathMatch = file.file_url.match(/\/materials\/(.+?)(?:\?.*)?$/);
        
        if (pathMatch) {
          const storagePath = pathMatch[1];
          // Generate a signed URL for internal processing
          const { data: signedData } = await supabaseAdmin.storage
            .from("materials")
            .createSignedUrl(storagePath, 60);
          
          if (signedData?.signedUrl) {
            finalUrl = signedData.signedUrl;
          }
        }

        // Extract text from file using the (potentially signed) URL
        const extractedText = await extractFileText(
          finalUrl,
          file.file_name,
          file.file_type,
          openai
        );

        // Cache it
        await supabaseAdmin
          .from("post_ai_file_cache")
          .insert({
            material_id: materialId,
            file_name: file.file_name,
            file_type: file.file_type,
            extracted_text: extractedText,
          })
          .select()
          .maybeSingle();

        fileContext += `\n\n[File: ${file.file_name}]\n${extractedText}`;
      }
    }

    // Add user message to history
    messages.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Prepare context for AI
    const systemPrompt = `You are a helpful AI tutor assistant for a study material sharing platform. 
You are helping a student understand the following study material:

Title: ${material.title}
Subject: ${material.subject}
Type: ${material.type}
Description: ${material.description || "No description provided"}

${fileContext ? `\nAttached Files Content:\n${fileContext}` : "No files attached"}

Please answer questions about this material clearly and helpfully. If the student asks something unrelated to the material, politely redirect them back to the topic.`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || "";

    // Add assistant response to history
    messages.push({
      role: "assistant",
      content: assistantMessage,
      timestamp: new Date().toISOString(),
    });

    // Save updated conversation
    await saveConversation(supabaseAdmin, materialId, userId, messages);

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantMessage,
        conversationId: materialId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("post-ai-chat error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
