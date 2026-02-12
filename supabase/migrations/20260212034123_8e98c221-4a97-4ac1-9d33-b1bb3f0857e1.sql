
-- Drop all restrictive policies on materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON public.materials;
DROP POLICY IF EXISTS "Users can delete their own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can insert their own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update their own materials" ON public.materials;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Materials are viewable by everyone"
ON public.materials FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own materials"
ON public.materials FOR INSERT
WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Users can update their own materials"
ON public.materials FOR UPDATE
USING (auth.uid() = uploader_id);

CREATE POLICY "Users can delete their own materials"
ON public.materials FOR DELETE
USING (auth.uid() = uploader_id);

-- Fix profiles too
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
