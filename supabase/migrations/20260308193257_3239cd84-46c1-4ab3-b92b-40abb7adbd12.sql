
-- Drop restrictive policies
DROP POLICY IF EXISTS "Anyone can view open requests" ON public.material_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON public.material_requests;
DROP POLICY IF EXISTS "Users can update own requests" ON public.material_requests;

-- Recreate as permissive
CREATE POLICY "Anyone can view open requests"
ON public.material_requests FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can insert own requests"
ON public.material_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_user_id);

CREATE POLICY "Users can update own requests"
ON public.material_requests FOR UPDATE
TO authenticated
USING (auth.uid() = requester_user_id);
