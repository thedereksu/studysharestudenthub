
-- Add credit_balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 10;

-- Track which users have unlocked which materials
CREATE TABLE public.unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, material_id)
);
ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unlocks" ON public.unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own unlocks" ON public.unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add credit_price to materials for paid items
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS credit_price integer NOT NULL DEFAULT 5;

-- Conversations table
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id uuid NOT NULL REFERENCES public.profiles(id),
  user2_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages table
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  ));
CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  ));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Atomic credit transfer function
CREATE OR REPLACE FUNCTION public.unlock_material(p_material_id uuid, p_buyer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer;
  v_seller_id uuid;
  v_buyer_balance integer;
BEGIN
  -- Get material info
  SELECT credit_price, uploader_id INTO v_price, v_seller_id
  FROM materials WHERE id = p_material_id;

  IF v_seller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Material not found');
  END IF;

  IF v_seller_id = p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'You own this material');
  END IF;

  -- Check already unlocked
  IF EXISTS (SELECT 1 FROM unlocks WHERE user_id = p_buyer_id AND material_id = p_material_id) THEN
    RETURN json_build_object('success', true, 'error', 'Already unlocked');
  END IF;

  -- Check buyer balance
  SELECT credit_balance INTO v_buyer_balance FROM profiles WHERE id = p_buyer_id FOR UPDATE;
  IF v_buyer_balance < v_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Deduct from buyer
  UPDATE profiles SET credit_balance = credit_balance - v_price WHERE id = p_buyer_id;
  -- Credit seller
  UPDATE profiles SET credit_balance = credit_balance + v_price WHERE id = v_seller_id;
  -- Record unlock
  INSERT INTO unlocks (user_id, material_id) VALUES (p_buyer_id, p_material_id);

  RETURN json_build_object('success', true);
END;
$$;
