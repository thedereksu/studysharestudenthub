
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS ownership_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_promoted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'material_purchase', 'admin_grant', 'admin_adjustment', 'refund', 'promotion_purchase')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON public.credit_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
