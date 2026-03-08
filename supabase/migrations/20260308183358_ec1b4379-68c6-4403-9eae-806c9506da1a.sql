-- Create blocked_emails table
CREATE TABLE public.blocked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text,
  blocked_by_admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can see blocked emails
CREATE POLICY "Admins can view blocked emails"
ON public.blocked_emails FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert blocked emails"
ON public.blocked_emails FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blocked emails"
ON public.blocked_emails FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if an email is blocked (security definer for login check)
CREATE OR REPLACE FUNCTION public.is_email_blocked(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_emails WHERE email = lower(trim(check_email))
  )
$$;