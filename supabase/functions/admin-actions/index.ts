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
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

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

    const body = await req.json();
    const { action, targetId, status: reqStatus } = body;
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
      // Get profiles
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("list_users result:", profiles?.length, "error:", profilesError);

      // Get auth users to get emails
      const { data: { users: authUsers }, error: authListError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      console.log("auth users result:", authUsers?.length, "error:", authListError);

      // Get blocked emails
      const { data: blockedEmails } = await supabaseAdmin
        .from("blocked_emails")
        .select("email");
      const blockedSet = new Set((blockedEmails || []).map((b: any) => b.email.toLowerCase()));

      // Map emails to profiles
      const emailMap = new Map<string, string>();
      for (const au of authUsers || []) {
        if (au.email) emailMap.set(au.id, au.email);
      }

      const usersWithEmail = (profiles || []).map((p: any) => ({
        ...p,
        email: emailMap.get(p.id) || null,
        is_blocked: emailMap.get(p.id) ? blockedSet.has(emailMap.get(p.id)!.toLowerCase()) : false,
      }));

      return new Response(JSON.stringify({ users: usersWithEmail }), {
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

    if (action === "list_reports") {
      const { data: reports, error: reportsError } = await supabaseAdmin
        .from("reports")
        .select("*, materials(title), profiles!reports_reporter_user_id_fkey(name)")
        .order("created_at", { ascending: false });

      console.log("list_reports result:", reports?.length, "error:", reportsError);

      const mapped = (reports || []).map((r: any) => ({
        ...r,
        material_title: r.materials?.title || null,
        reporter_name: r.profiles?.name || null,
        materials: undefined,
        profiles: undefined,
      }));

      return new Response(JSON.stringify({ reports: mapped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_report_status") {
      const newStatus = reqStatus || "reviewed";
      const { error } = await supabaseAdmin
        .from("reports")
        .update({ status: newStatus })
        .eq("id", targetId);
      if (error) {
        console.error("update_report_status error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: `report_${newStatus}`,
        target_id: targetId,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "adjust_credits") {
      const { targetUserId, amount, adjustmentType, reason } = body;
      if (!targetUserId || !amount || !adjustmentType) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const numAmount = Math.abs(parseInt(amount));
      if (isNaN(numAmount) || numAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const delta = adjustmentType === "add" ? numAmount : -numAmount;

      // Check current balance for subtract
      if (delta < 0) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credit_balance")
          .eq("id", targetUserId)
          .single();
        if (!profile || profile.credit_balance + delta < 0) {
          return new Response(JSON.stringify({ error: "Insufficient balance" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update balance
      const { error: updateError } = await supabaseAdmin.rpc("", {});
      // Use raw update instead
      const { error: balanceError } = await supabaseAdmin
        .from("profiles")
        .update({ credit_balance: supabaseAdmin.rpc ? undefined : undefined })
        .eq("id", targetUserId);

      // Actually we need to do an increment. Let's just fetch and update.
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("credit_balance")
        .eq("id", targetUserId)
        .single();

      if (!currentProfile) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newBalance = currentProfile.credit_balance + delta;
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ credit_balance: newBalance })
        .eq("id", targetUserId);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record transaction
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: targetUserId,
        amount: delta,
        type: "admin_adjustment",
        description: reason || `Admin ${adjustmentType === "add" ? "added" : "subtracted"} ${numAmount} credits`,
      });

      // Audit log
      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "adjust_credits",
        target_id: targetUserId,
        details: { amount: delta, reason, new_balance: newBalance },
      });

      return new Response(JSON.stringify({ success: true, new_balance: newBalance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "block_email") {
      const { email: blockEmail, reason: blockReason } = body;
      if (!blockEmail) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = blockEmail.toLowerCase().trim();

      // Insert into blocked_emails
      const { error: blockError } = await supabaseAdmin
        .from("blocked_emails")
        .upsert({ email: normalizedEmail, reason: blockReason || null, blocked_by_admin_id: user.id }, { onConflict: "email" });

      if (blockError) {
        console.error("block_email error:", blockError);
        return new Response(JSON.stringify({ error: blockError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "block_email",
        target_id: targetId || normalizedEmail,
        details: { email: normalizedEmail, reason: blockReason },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unblock_email") {
      const { email: unblockEmail } = body;
      if (!unblockEmail) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = unblockEmail.toLowerCase().trim();

      const { error: unblockError } = await supabaseAdmin
        .from("blocked_emails")
        .delete()
        .eq("email", normalizedEmail);

      if (unblockError) {
        console.error("unblock_email error:", unblockError);
        return new Response(JSON.stringify({ error: unblockError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: user.id,
        action_type: "unblock_email",
        target_id: targetId || normalizedEmail,
        details: { email: normalizedEmail },
      });

      return new Response(JSON.stringify({ success: true }), {
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
