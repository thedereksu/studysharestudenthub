-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view own badge applications" ON public.badge_applications;
DROP POLICY IF EXISTS "Admins can view all badge applications" ON public.badge_applications;
DROP POLICY IF EXISTS "Users can insert own badge applications" ON public.badge_applications;
DROP POLICY IF EXISTS "Admins can update badge applications" ON public.badge_applications;

-- Recreate as permissive policies
CREATE POLICY "Users can view own badge applications"
ON public.badge_applications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all badge applications"
ON public.badge_applications FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own badge applications"
ON public.badge_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update badge applications"
ON public.badge_applications FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));