
-- Create a public-facing view that omits credit_balance
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, name, school, bio, has_featured_badge, created_at, updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
