import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Admin action: No auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Admin action: Auth failed", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    console.log("Admin role check for", user.id, "result:", roleData, "error:", roleError);

    if (!roleData) {
      console.error("Admin action: User not admin", user.id);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, targetId } = await req.json();
    console.log("Admin action:", action, "target:", targetId);

    if (action === "delete_material") {
      const { data: material } = await supabaseAdmin
        .from("materials")
        .select("*")
        .eq("id", targetId)
        .single();

      if (!material) {
        return new Response(JSON.stringify({ error: "Material not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete storage files
      const files = (material.files as any[]) || [];
      for (const f of files) {
        if (f.file_url) {
          const pathMatch = f.file_url.match(/\/materials\/(.+?)(?:\?.*)?$/);
          if (pathMatch) {
            await supabaseAdmin.storage.from("materials").remove([pathMatch[1]]);
          }
        }
      }
      if (material.file_url) {
        const pathMatch = material.file_url.match(/\/materials\/(.+?)(?:\?.*)?$/);
        if (pathMatch) {
          await supabaseAdmin.storage.from("materials").remove([pathMatch[1]]);
        }
      }

      // Delete related data
      await supabaseAdmin.from("comments").delete().eq("material_id", targetId);
      await supabaseAdmin.from("reviews").delete().eq("material_id", targetId);
      await supabaseAdmin.from("unlocks").delete().eq("material_id", targetId);
      await supabaseAdmin.from("materials").delete().eq("id", targetId);

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "delete_material",
        target_id: targetId,
        details: { title: material.title, uploader_id: material.uploader_id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { data: materials } = await supabaseAdmin
        .from("materials")
        .select("*")
        .eq("uploader_id", targetId);

      for (const material of materials || []) {
        const files = (material.files as any[]) || [];
        for (const f of files) {
          if (f.file_url) {
            const pathMatch = f.file_url.match(/\/materials\/(.+?)(?:\?.*)?$/);
            if (pathMatch) {
              await supabaseAdmin.storage.from("materials").remove([pathMatch[1]]);
            }
          }
        }
        if (material.file_url) {
          const pathMatch = material.file_url.match(/\/materials\/(.+?)(?:\?.*)?$/);
          if (pathMatch) {
            await supabaseAdmin.storage.from("materials").remove([pathMatch[1]]);
          }
        }
      }

      const materialIds = (materials || []).map((m: any) => m.id);
      if (materialIds.length > 0) {
        await supabaseAdmin.from("comments").delete().in("material_id", materialIds);
        await supabaseAdmin.from("reviews").delete().in("material_id", materialIds);
        await supabaseAdmin.from("unlocks").delete().in("material_id", materialIds);
      }
      await supabaseAdmin.from("comments").delete().eq("user_id", targetId);
      await supabaseAdmin.from("reviews").delete().eq("reviewer_id", targetId);
      await supabaseAdmin.from("unlocks").delete().eq("user_id", targetId);
      await supabaseAdmin.from("materials").delete().eq("uploader_id", targetId);
      await supabaseAdmin.from("messages").delete().eq("sender_id", targetId);
      await supabaseAdmin.from("conversations").delete().or(`user1_id.eq.${targetId},user2_id.eq.${targetId}`);
      await supabaseAdmin.from("profiles").delete().eq("id", targetId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId);

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (deleteAuthError) {
        console.error("Failed to delete auth user:", deleteAuthError);
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "delete_user",
        target_id: targetId,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("list_users result:", profiles?.length, "error:", profilesError);

      return new Response(JSON.stringify({ users: profiles || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_materials") {
      const { data: mats, error: matsError } = await supabaseAdmin
        .from("materials")
        .select("*, profiles!materials_uploader_id_profiles_fkey(name)")
        .order("created_at", { ascending: false });

      console.log("list_materials result:", mats?.length, "error:", matsError);

      return new Response(JSON.stringify({ materials: mats || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_comment") {
      const { error } = await supabaseAdmin.from("comments").delete().eq("id", targetId);
      if (error) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "delete_comment",
        target_id: targetId,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_audit_log") {
      const { data: logs, error: logsError } = await supabaseAdmin
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      console.log("list_audit_log result:", logs?.length, "error:", logsError);

      return new Response(JSON.stringify({ logs: logs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin action error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
