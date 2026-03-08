
-- Create material_requests table
CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward_credits integer NOT NULL CHECK (reward_credits >= 1),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fulfilled', 'cancelled')),
  fulfilled_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- Everyone can view open requests
CREATE POLICY "Anyone can view open requests" ON public.material_requests
  FOR SELECT TO authenticated USING (true);

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests" ON public.material_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_user_id);

-- Users can update their own requests (cancel)
CREATE POLICY "Users can update own requests" ON public.material_requests
  FOR UPDATE TO authenticated USING (auth.uid() = requester_user_id);

-- Atomic RPC to create a request with credit reservation
CREATE OR REPLACE FUNCTION public.create_material_request(p_title text, p_description text, p_reward_credits integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_reward_credits < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Reward must be at least 1 credit');
  END IF;

  IF length(trim(p_title)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Title is required');
  END IF;

  -- Lock and check balance
  SELECT credit_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance < p_reward_credits THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You need at least ' || p_reward_credits || ' credits.');
  END IF;

  -- Reserve credits
  UPDATE profiles SET credit_balance = credit_balance - p_reward_credits WHERE id = v_user_id;

  -- Create request
  INSERT INTO material_requests (requester_user_id, title, description, reward_credits)
  VALUES (v_user_id, trim(p_title), trim(p_description), p_reward_credits)
  RETURNING id INTO v_request_id;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -p_reward_credits, 'request_reservation', 'Credits reserved for material request');

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- Atomic RPC to cancel a request and refund credits
CREATE OR REPLACE FUNCTION public.cancel_material_request(p_request_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_request FROM material_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  IF v_request.requester_user_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'You do not own this request');
  END IF;
  IF v_request.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Request is not open');
  END IF;

  -- Refund credits
  UPDATE profiles SET credit_balance = credit_balance + v_request.reward_credits WHERE id = v_user_id;
  UPDATE material_requests SET status = 'cancelled' WHERE id = p_request_id;

  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_request.reward_credits, 'request_refund', 'Refund for cancelled material request');

  RETURN json_build_object('success', true);
END;
$$;

-- Atomic RPC to fulfill a request and transfer credits
CREATE OR REPLACE FUNCTION public.fulfill_material_request(p_request_id uuid, p_fulfiller_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
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
$$;
