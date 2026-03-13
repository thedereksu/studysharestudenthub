
-- Create a helper function for teacher approval (uses text cast to avoid enum commit issue)
CREATE OR REPLACE FUNCTION public.has_teacher_or_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('teacher', 'admin')
  )
$$;
