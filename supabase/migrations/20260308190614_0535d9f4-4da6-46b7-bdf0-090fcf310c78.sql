
-- Fix 1: Restrict profiles SELECT to authenticated users only
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Fix 2: Create atomic promote_material RPC
CREATE OR REPLACE FUNCTION public.promote_material(p_material_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_owner_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify ownership
  SELECT uploader_id INTO v_owner_id FROM materials WHERE id = p_material_id;
  IF v_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Material not found');
  END IF;
  IF v_owner_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'You do not own this material');
  END IF;

  -- Check if already promoted
  IF EXISTS (SELECT 1 FROM materials WHERE id = p_material_id AND is_promoted = true AND promotion_expires_at > now()) THEN
    RETURN json_build_object('success', false, 'error', 'Already promoted');
  END IF;

  -- Lock and check balance
  SELECT credit_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance < 3 THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You need at least 3 credits.');
  END IF;

  -- Deduct credits
  UPDATE profiles SET credit_balance = credit_balance - 3 WHERE id = v_user_id;

  -- Set promotion
  UPDATE materials SET is_promoted = true, promotion_expires_at = now() + interval '24 hours' WHERE id = p_material_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -3, 'promotion_purchase', 'Item promotion for 24 hours');

  RETURN json_build_object('success', true);
END;
$$;
