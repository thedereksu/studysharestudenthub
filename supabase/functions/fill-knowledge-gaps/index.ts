import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Identify a subject/class that needs content
    // For this implementation, we'll pick a random subject from a predefined list
    // In a more advanced version, this would query the DB for empty subjects
    const subjects = [
      { subject: "Biology", class: "Biology 101", topic: "Cellular Respiration" },
      { subject: "History", class: "World History", topic: "The Industrial Revolution" },
      { subject: "Computer Science", class: "Intro to CS", topic: "Data Structures" },
      { subject: "Mathematics", class: "Calculus I", topic: "Derivatives" },
      { subject: "Psychology", class: "Intro to Psychology", topic: "Cognitive Development" }
    ];
    
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];

    // 2. Generate content using Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are Sage, an expert academic AI tutor for StudySwap.
      Your task is to generate a high-quality, foundational "Quick Notes" study guide for a university-level course.
      
      Subject: ${randomSubject.subject}
      Class: ${randomSubject.class}
      Topic: ${randomSubject.topic}
      
      Format the output as a clean, well-structured Markdown document.
      Include:
      1. A brief overview of the topic.
      2. Key concepts and definitions (bullet points).
      3. Important processes or formulas (if applicable).
      4. A short summary paragraph.
      
      Keep it concise but informative, acting as a quick reference guide for students.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text();

    // 3. Create a text file from the content
    const fileName = `${randomSubject.class.replace(/\s+/g, '_')}_${randomSubject.topic.replace(/\s+/g, '_')}_QuickNotes.txt`;
    const fileContent = new TextEncoder().encode(generatedContent);

    // 4. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("materials")
      .upload(`sage-generated/${fileName}`, fileContent, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from("materials")
      .getPublicUrl(`sage-generated/${fileName}`);

    // 5. Insert record into materials table
    // We need a system user ID for Sage. For now, we'll use a placeholder or the first admin user.
    // Ideally, there should be a dedicated 'Sage AI' user account in auth.users.
    // Let's try to find an admin user or just use a dummy UUID if constraints allow (unlikely due to FK).
    // For this script, we will query for a user to act as the 'uploader'.
    
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    if (usersError || !users || users.users.length === 0) {
        throw new Error("Could not find a user to assign as the uploader.");
    }
    
    const systemUserId = users.users[0].id;

    const title = `${randomSubject.class} Quick Notes (${randomSubject.topic})`;
    const description = `Sage-Generated Foundational Content: A quick reference study guide covering key concepts of ${randomSubject.topic} for ${randomSubject.class}.`;

    const { data: insertData, error: insertError } = await supabaseClient
      .from("materials")
      .insert({
        uploader_id: systemUserId,
        title: title,
        subject: randomSubject.subject,
        type: "Study Guide",
        exchange_type: "Free",
        description: description,
        file_url: publicUrlData.publicUrl,
        file_type: "text/plain",
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert material record: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Knowledge gap filled successfully",
        material: insertData
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error filling knowledge gap:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
