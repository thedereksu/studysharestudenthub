
-- Add promotion_tier to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS promotion_tier text;

-- Add has_featured_badge to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_featured_badge boolean NOT NULL DEFAULT false;

-- Update promote_material RPC to support tiers
CREATE OR REPLACE FUNCTION public.promote_material(p_material_id uuid, p_tier text DEFAULT '24h')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_owner_id uuid;
  v_cost integer;
  v_duration interval;
  v_desc text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Determine tier cost and duration
  IF p_tier = '24h' THEN
    v_cost := 3; v_duration := interval '24 hours'; v_desc := 'Item promotion (24h)';
  ELSIF p_tier = '3d' THEN
    v_cost := 8; v_duration := interval '3 days'; v_desc := 'Item promotion (3 days)';
  ELSIF p_tier = '7d' THEN
    v_cost := 20; v_duration := interval '7 days'; v_desc := 'Item promotion (7 days)';
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid promotion tier');
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
  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You need at least ' || v_cost || ' credits.');
  END IF;

  -- Deduct credits
  UPDATE profiles SET credit_balance = credit_balance - v_cost WHERE id = v_user_id;

  -- Set promotion
  UPDATE materials SET is_promoted = true, promotion_expires_at = now() + v_duration, promotion_tier = p_tier WHERE id = p_material_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -v_cost, 'promotion_purchase', v_desc);

  RETURN json_build_object('success', true);
END;
$$;

-- Create purchase_featured_badge RPC
CREATE OR REPLACE FUNCTION public.purchase_featured_badge()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_has_badge boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if already has badge
  SELECT has_featured_badge INTO v_has_badge FROM profiles WHERE id = v_user_id;
  IF v_has_badge THEN
    RETURN json_build_object('success', false, 'error', 'You already have the Featured Contributor badge');
  END IF;

  -- Lock and check balance
  SELECT credit_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance < 50 THEN
    RETURN json_build_object('success', false, 'error', 'You need 50 credits to purchase this badge.');
  END IF;

  -- Deduct credits
  UPDATE profiles SET credit_balance = credit_balance - 50, has_featured_badge = true WHERE id = v_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -50, 'badge_purchase', 'Featured Contributor Badge');

  RETURN json_build_object('success', true);
END;
$$;
