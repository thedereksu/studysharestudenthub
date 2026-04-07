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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify auth using anon client with user's token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Admin action: No auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Admin action: Auth failed", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    console.log("Admin role check for", userId, "result:", roleData, "error:", roleError);

    if (!roleData) {
      console.error("Admin action: User not admin", userId);
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
        admin_id: userId,
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
        admin_id: userId,
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

      // Get user roles
      const { data: allRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");
      const roleMap = new Map<string, string[]>();
      for (const r of allRoles || []) {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      }

      // Map emails to profiles
      const emailMap = new Map<string, string>();
      for (const au of authUsers || []) {
        if (au.email) emailMap.set(au.id, au.email);
      }

      const usersWithEmail = (profiles || []).map((p: any) => ({
        ...p,
        email: emailMap.get(p.id) || null,
        is_blocked: emailMap.get(p.id) ? blockedSet.has(emailMap.get(p.id)!.toLowerCase()) : false,
        roles: roleMap.get(p.id) || [],
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
        admin_id: userId,
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
        admin_id: userId,
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
      if (newBalance < 0) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      await supabaseAdmin.from("credit_transactions").insert({
        user_id: targetUserId,
        amount: delta,
        type: "admin_adjustment",
        description: reason || `Admin ${adjustmentType === "add" ? "added" : "subtracted"} ${numAmount} credits`,
      });

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
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
        .upsert({ email: normalizedEmail, reason: blockReason || null, blocked_by_admin_id: userId }, { onConflict: "email" });

      if (blockError) {
        console.error("block_email error:", blockError);
        return new Response(JSON.stringify({ error: blockError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
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
        admin_id: userId,
        action_type: "unblock_email",
        target_id: targetId || normalizedEmail,
        details: { email: normalizedEmail },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_badge_applications") {
      const { data: apps, error: appsError } = await supabaseAdmin
        .from("badge_applications")
        .select("*, profiles!badge_applications_user_id_fkey(name)")
        .order("created_at", { ascending: false });

      console.log("list_badge_applications result:", apps?.length, "error:", appsError);

      // Get emails for applicants
      const { data: { users: authUsers2 } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const emailMap2 = new Map<string, string>();
      for (const au of authUsers2 || []) {
        if (au.email) emailMap2.set(au.id, au.email);
      }

      const mapped = (apps || []).map((a: any) => ({
        ...a,
        applicant_name: a.profiles?.name || null,
        applicant_email: emailMap2.get(a.user_id) || null,
        profiles: undefined,
      }));

      return new Response(JSON.stringify({ applications: mapped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "review_badge_application") {
      const { decision } = body; // "approved" or "denied"
      if (!targetId || !decision || !["approved", "denied"].includes(decision)) {
        return new Response(JSON.stringify({ error: "Invalid decision" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: app } = await supabaseAdmin
        .from("badge_applications")
        .select("*")
        .eq("id", targetId)
        .single();

      if (!app) {
        return new Response(JSON.stringify({ error: "Application not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (app.status !== "pending") {
        return new Response(JSON.stringify({ error: "Application already reviewed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update application status
      await supabaseAdmin
        .from("badge_applications")
        .update({ status: decision, reviewed_by_admin_id: userId, updated_at: new Date().toISOString() })
        .eq("id", targetId);

      if (decision === "approved") {
        // Grant the badge
        await supabaseAdmin
          .from("profiles")
          .update({ has_featured_badge: true })
          .eq("id", app.user_id);
      } else {
        // Denied — refund credits
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credit_balance")
          .eq("id", app.user_id)
          .single();
        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ credit_balance: profile.credit_balance + 15 })
            .eq("id", app.user_id);
          await supabaseAdmin.from("credit_transactions").insert({
            user_id: app.user_id,
            amount: 15,
            type: "badge_application_refund",
            description: "Badge application denied — credits refunded",
          });
        }
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
        action_type: `badge_application_${decision}`,
        target_id: targetId,
        details: { applicant_id: app.user_id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_requests") {
      const { data: reqs, error: reqsError } = await supabaseAdmin
        .from("material_requests")
        .select("*, profiles!material_requests_requester_user_id_fkey(name)")
        .order("created_at", { ascending: false });

      console.log("list_requests result:", reqs?.length, "error:", reqsError);

      return new Response(JSON.stringify({ requests: reqs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_request") {
      // Refund credits if request is open
      const { data: request } = await supabaseAdmin
        .from("material_requests")
        .select("*")
        .eq("id", targetId)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (request.status === "open") {
        await supabaseAdmin
          .from("profiles")
          .update({ credit_balance: supabaseAdmin.rpc ? undefined : undefined })
          .eq("id", request.requester_user_id);
        // Use raw SQL-like approach: fetch balance, add, update
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credit_balance")
          .eq("id", request.requester_user_id)
          .single();
        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ credit_balance: profile.credit_balance + request.reward_credits })
            .eq("id", request.requester_user_id);
          await supabaseAdmin.from("credit_transactions").insert({
            user_id: request.requester_user_id,
            amount: request.reward_credits,
            type: "request_refund",
            description: "Admin deleted request — credits refunded",
          });
        }
      }

      await supabaseAdmin.from("material_requests").delete().eq("id", targetId);

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
        action_type: "delete_request",
        target_id: targetId,
        details: { title: request.title, requester: request.requester_user_id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign_teacher") {
      if (!targetId) {
        return new Response(JSON.stringify({ error: "Target user ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already has teacher role
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", targetId)
        .eq("role", "teacher")
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: targetId, role: "teacher" });
        if (insertErr) {
          console.error("assign_teacher error:", insertErr);
          return new Response(JSON.stringify({ error: insertErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
        action_type: "assign_teacher",
        target_id: targetId,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove_teacher") {
      if (!targetId) {
        return new Response(JSON.stringify({ error: "Target user ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetId)
        .eq("role", "teacher");

      // Also clear any teacher approvals made by this user
      await supabaseAdmin
        .from("materials")
        .update({ teacher_approved: false, approved_by_teacher_id: null, approved_at: null })
        .eq("approved_by_teacher_id", targetId);

      await supabaseAdmin.from("admin_actions").insert({
        admin_id: userId,
        action_type: "remove_teacher",
        target_id: targetId,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_messages") {
      // Fetch all messages with sender name and conversation participants
      const { data: messages, error: messagesError } = await supabaseAdmin
        .from("messages")
        .select(`
          id,
          content,
          created_at,
          sender_id,
          conversation_id,
          sender:profiles!messages_sender_id_fkey(id, name),
          conversation:conversations!messages_conversation_id_fkey(
            id,
            user1_id,
            user2_id,
            user1:profiles!conversations_user1_id_fkey(id, name),
            user2:profiles!conversations_user2_id_fkey(id, name)
          )
        `)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("list_messages error:", messagesError);
        return new Response(JSON.stringify({ error: messagesError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ messages: messages || [] }), {
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
