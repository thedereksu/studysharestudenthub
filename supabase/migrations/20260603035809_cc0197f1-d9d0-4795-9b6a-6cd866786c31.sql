
-- 1) Restrict profiles public read so credit_balance is not exposed
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

-- Ensure public_profiles view uses caller's permissions and is readable
ALTER VIEW public.public_profiles SET (security_invoker = on);
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Lock post_ai_file_cache to service role only
REVOKE ALL ON public.post_ai_file_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.post_ai_file_cache TO service_role;

-- 3) Replace permissive teacher/admin material update policy with column-restricted variant via trigger
DROP POLICY IF EXISTS "Teachers and admins can update teacher approval" ON public.materials;

CREATE OR REPLACE FUNCTION public.enforce_material_update_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owners and admins may update anything
  IF auth.uid() = OLD.uploader_id OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Teachers (non-owner, non-admin) may only toggle ownership_confirmed
  IF public.has_role(auth.uid(), 'teacher'::app_role) THEN
    IF NEW.uploader_id        IS DISTINCT FROM OLD.uploader_id
       OR NEW.title           IS DISTINCT FROM OLD.title
       OR NEW.subject         IS DISTINCT FROM OLD.subject
       OR NEW.type            IS DISTINCT FROM OLD.type
       OR NEW.description     IS DISTINCT FROM OLD.description
       OR NEW.exchange_type   IS DISTINCT FROM OLD.exchange_type
       OR NEW.credit_price    IS DISTINCT FROM OLD.credit_price
       OR NEW.file_url        IS DISTINCT FROM OLD.file_url
       OR NEW.file_type       IS DISTINCT FROM OLD.file_type
       OR NEW.files           IS DISTINCT FROM OLD.files
       OR NEW.is_promoted     IS DISTINCT FROM OLD.is_promoted
       OR NEW.promotion_tier  IS DISTINCT FROM OLD.promotion_tier
       OR NEW.promotion_expires_at IS DISTINCT FROM OLD.promotion_expires_at
    THEN
      RAISE EXCEPTION 'Teachers can only update the approval flag on materials they do not own';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorized to update this material';
END;
$$;

DROP TRIGGER IF EXISTS enforce_material_update_scope ON public.materials;
CREATE TRIGGER enforce_material_update_scope
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.enforce_material_update_scope();

CREATE POLICY "Teachers and admins can update materials for approval"
ON public.materials
FOR UPDATE
TO authenticated
USING (public.has_teacher_or_admin_role(auth.uid()))
WITH CHECK (public.has_teacher_or_admin_role(auth.uid()));

-- 4) Lock down SECURITY DEFINER function execution
-- User-callable RPCs: signed-in users only
REVOKE EXECUTE ON FUNCTION public.promote_material(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_material(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unlock_material(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_material_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_material_request(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fulfill_material_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_for_featured_badge(text) FROM PUBLIC, anon;

-- Backend-only: revoke from all client roles
REVOKE EXECUTE ON FUNCTION public.add_stripe_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_blocked(text) FROM PUBLIC, anon, authenticated;

-- Role-check helpers used inside RLS — keep available to authenticated (needed for policy evaluation), revoke from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_teacher_or_admin_role(uuid) FROM PUBLIC, anon;

-- Trigger functions: never need client EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_unlock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_unread_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_credit_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
