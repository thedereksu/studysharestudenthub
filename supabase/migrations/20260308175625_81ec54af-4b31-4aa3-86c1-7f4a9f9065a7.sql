CREATE OR REPLACE FUNCTION public.unlock_material(p_material_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_buyer_id uuid := auth.uid();
  v_price integer;
  v_seller_id uuid;
  v_buyer_balance integer;
BEGIN
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get material info
  SELECT credit_price, uploader_id INTO v_price, v_seller_id
  FROM materials WHERE id = p_material_id;

  IF v_seller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Material not found');
  END IF;

  IF v_seller_id = v_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'You own this material');
  END IF;

  -- Check already unlocked
  IF EXISTS (SELECT 1 FROM unlocks WHERE user_id = v_buyer_id AND material_id = p_material_id) THEN
    RETURN json_build_object('success', true, 'error', 'Already unlocked');
  END IF;

  -- Check buyer balance
  SELECT credit_balance INTO v_buyer_balance FROM profiles WHERE id = v_buyer_id FOR UPDATE;
  IF v_buyer_balance < v_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Deduct from buyer
  UPDATE profiles SET credit_balance = credit_balance - v_price WHERE id = v_buyer_id;
  -- Credit seller
  UPDATE profiles SET credit_balance = credit_balance + v_price WHERE id = v_seller_id;
  -- Record unlock
  INSERT INTO unlocks (user_id, material_id) VALUES (v_buyer_id, p_material_id);

  RETURN json_build_object('success', true);
END;
$$;