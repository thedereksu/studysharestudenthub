
-- Create badge_applications table
CREATE TABLE public.badge_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own badge applications" ON public.badge_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own applications
CREATE POLICY "Users can insert own badge applications" ON public.badge_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all badge applications" ON public.badge_applications
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update applications
CREATE POLICY "Admins can update badge applications" ON public.badge_applications
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RPC to apply for featured badge (costs 15 credits)
CREATE OR REPLACE FUNCTION public.apply_for_featured_badge(p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_has_badge boolean;
  v_existing record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if already has badge
  SELECT has_featured_badge INTO v_has_badge FROM profiles WHERE id = v_user_id;
  IF v_has_badge THEN
    RETURN json_build_object('success', false, 'error', 'You already have the Featured Contributor badge');
  END IF;

  -- Check if there's already a pending application
  SELECT * INTO v_existing FROM badge_applications WHERE user_id = v_user_id AND status = 'pending';
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending application');
  END IF;

  IF length(trim(p_reason)) < 10 THEN
    RETURN json_build_object('success', false, 'error', 'Please provide a reason with at least 10 characters');
  END IF;

  -- Lock and check balance
  SELECT credit_balance INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF v_balance < 15 THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You need at least 15 credits.');
  END IF;

  -- Deduct credits
  UPDATE profiles SET credit_balance = credit_balance - 15 WHERE id = v_user_id;

  -- Create application
  INSERT INTO badge_applications (user_id, reason) VALUES (v_user_id, trim(p_reason));

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -15, 'badge_application', 'Featured Contributor Badge application fee');

  RETURN json_build_object('success', true);
END;
$$;

-- Drop old purchase_featured_badge function
DROP FUNCTION IF EXISTS public.purchase_featured_badge();
