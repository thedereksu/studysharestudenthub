
CREATE OR REPLACE FUNCTION public.fulfill_material_request(p_request_id uuid, p_fulfiller_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Prevent self-fulfillment
  IF p_fulfiller_id = v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Requester cannot self-fulfill');
  END IF;

  -- Validate fulfiller exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_fulfiller_id) THEN
    RETURN json_build_object('success', false, 'error', 'Fulfiller not found');
  END IF;

  SELECT * INTO v_request FROM material_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  IF v_request.requester_user_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the requester can mark as fulfilled');
  END IF;
  IF v_request.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Request is not open');
  END IF;

  -- Transfer credits to fulfiller (already deducted from requester)
  UPDATE profiles SET credit_balance = credit_balance + v_request.reward_credits WHERE id = p_fulfiller_id;
  UPDATE material_requests SET status = 'fulfilled', fulfilled_by_user_id = p_fulfiller_id WHERE id = p_request_id;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -v_request.reward_credits, 'request_payment', 'Payment for fulfilled material request');

  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_fulfiller_id, v_request.reward_credits, 'request_reward', 'Reward for fulfilling material request');

  RETURN json_build_object('success', true);
END;
$function$;
