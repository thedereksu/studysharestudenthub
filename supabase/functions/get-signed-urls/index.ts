import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractStoragePath(fileUrl: string): string | null {
  // Extract path after /materials/ from the stored URL
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/materials\/(.+?)(?:\?.*)?$/);
  if (match) return match[1];
  // Fallback: try after /materials/
  const fallback = fileUrl.match(/\/materials\/(.+?)(?:\?.*)?$/);
  return fallback ? fallback[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { materialId } = await req.json();
    if (!materialId) {
      return new Response(JSON.stringify({ error: "materialId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch material
    const { data: material, error: matError } = await supabaseAdmin
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (matError || !material) {
      return new Response(JSON.stringify({ error: "Material not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFree = material.exchange_type === "Free";

    // Check auth (optional - unauthenticated users can access free materials)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const supabaseAuth = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const isOwner = userId === material.uploader_id;

    // Check unlock status for non-free materials
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

    // Build file list
    const files = (material.files as any[])?.length
      ? (material.files as any[])
      : [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }];

    if (!canAccess) {
      // Return file metadata without URLs
      return new Response(JSON.stringify({
        canAccess: false,
        files: files.map((f: any) => ({
          file_name: f.file_name,
          file_type: f.file_type,
          file_url: null,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URLs (1 hour expiry)
    const signedFiles = [];
    for (const f of files) {
      const path = extractStoragePath(f.file_url);
      if (!path) {
        signedFiles.push({ ...f, file_url: null });
        continue;
      }
      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from("materials")
        .createSignedUrl(path, 3600);

      signedFiles.push({
        file_url: signError ? null : signedData.signedUrl,
        file_type: f.file_type,
        file_name: f.file_name,
      });
    }

    return new Response(JSON.stringify({
      canAccess: true,
      files: signedFiles,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-signed-urls error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
