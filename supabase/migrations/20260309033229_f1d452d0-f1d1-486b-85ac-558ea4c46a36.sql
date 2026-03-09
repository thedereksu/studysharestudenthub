
-- Fix materials SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON public.materials;
CREATE POLICY "Materials are viewable by everyone" ON public.materials FOR SELECT USING (true);

-- Fix profiles SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT USING (true);

-- Fix material_requests SELECT policies
DROP POLICY IF EXISTS "Anyone can view open requests" ON public.material_requests;
CREATE POLICY "Anyone can view open requests" ON public.material_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.material_requests;
CREATE POLICY "Admins can view all requests" ON public.material_requests FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix comments SELECT policy
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);

-- Fix reviews SELECT policy
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);

-- Fix profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Fix materials INSERT policy
DROP POLICY IF EXISTS "Users can insert their own materials" ON public.materials;
CREATE POLICY "Users can insert their own materials" ON public.materials FOR INSERT WITH CHECK (auth.uid() = uploader_id);

-- Fix materials UPDATE policy
DROP POLICY IF EXISTS "Users can update their own materials" ON public.materials;
CREATE POLICY "Users can update their own materials" ON public.materials FOR UPDATE USING (auth.uid() = uploader_id);

-- Fix materials DELETE policy
DROP POLICY IF EXISTS "Users can delete their own materials" ON public.materials;
CREATE POLICY "Users can delete their own materials" ON public.materials FOR DELETE USING (auth.uid() = uploader_id);
