
-- 1. Fix profiles: replace public SELECT with two policies
--    One for owner (full access), one for everyone else (via public_profiles view)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Owner can see their full profile including credit_balance
CREATE POLICY "Users can view their own full profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Recreate or replace the public_profiles view to exclude credit_balance
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, name, school, bio, has_featured_badge, created_at, updated_at
  FROM public.profiles;

-- Grant access on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2. Fix materials storage: restrict direct reads to file owners only
-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Authenticated users can read materials" ON storage.objects;

-- Owner-only read (files stored as {user_id}/...)
CREATE POLICY "Owners can read their own materials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
