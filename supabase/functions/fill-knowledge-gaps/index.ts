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

    // Hardcode AP Chemistry topics for this specific request
    const apChemTopics = [
      { subject: "Chemistry", class: "AP Chemistry", topic: "Thermodynamics" },
      { subject: "Chemistry", class: "AP Chemistry", topic: "Chemical Equilibrium" },
      { subject: "Chemistry", class: "AP Chemistry", topic: "Acid-Base Reactions" },
      { subject: "Chemistry", class: "AP Chemistry", topic: "Electrochemistry" },
      { subject: "Chemistry", class: "AP Chemistry", topic: "Kinetics" }
    ];
    
    const randomApChemTopic = apChemTopics[Math.floor(Math.random() * apChemTopics.length)];

    // 2. Generate content using Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are Sage, an expert academic AI tutor for StudySwap.
      Your task is to generate a high-quality, foundational "Quick Notes" study guide for an AP Chemistry course.
      The content should be concise but informative, suitable as a quick reference guide for students.
      Ensure the content does not overlap with basic chemistry topics already covered in general chemistry.
      
      Subject: ${randomApChemTopic.subject}
      Class: ${randomApChemTopic.class}
      Topic: ${randomApChemTopic.topic}
      
      Format the output as a clean, well-structured Markdown document.
      Include:
      1. A brief overview of the topic.
      2. Key concepts and definitions (bullet points).
      3. Important processes or formulas (if applicable).
      4. A short summary paragraph.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedContent = response.text();

    // 3. Create a text file from the content
    const fileName = `${randomApChemTopic.class.replace(/\s+/g, '_')}_${randomApChemTopic.topic.replace(/\s+/g, '_')}_QuickNotes.txt`;
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
    // We need a system user ID for Sage. For this, we will use a hardcoded UUID
    // that corresponds to a 'Sage AI' user in the auth.users table.
    // In a real scenario, this user would be created and managed.
    const SAGE_AI_USER_ID = "00000000-0000-0000-0000-000000000001"; // Placeholder UUID for Sage AI

    const title = `${randomApChemTopic.class} Quick Notes (${randomApChemTopic.topic})`;
    const description = `Sage-Generated Foundational Content: A quick reference study guide covering key concepts of ${randomApChemTopic.topic} for ${randomApChemTopic.class}.`;

    const { data: insertData, error: insertError } = await supabaseClient
      .from("materials")
      .insert({
        uploader_id: SAGE_AI_USER_ID,
        title: title,
        subject: randomApChemTopic.subject,
        type: "Study Guide",
        exchange_type: "Free",
        description: description,
        file_url: publicUrlData.publicUrl,
        file_type: "text/plain",
        is_ai_generated: true, // Set the new flag to true
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
