
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- Since profiles no longer has a public SELECT policy, the view needs
-- its own mechanism. We grant a permissive SELECT on profiles for the
-- specific columns via the view by adding a policy that allows reading
-- non-sensitive fields. Actually, the simplest approach: add a public
-- SELECT policy back but only allow it through the view pattern.
-- 
-- Better approach: just add a public SELECT policy that everyone can use,
-- since the view only exposes safe columns anyway.
-- The view with security_invoker=on will use the caller's permissions,
-- so we need a public SELECT policy on profiles for the view to work.
CREATE POLICY "Public can view basic profile info"
  ON public.profiles FOR SELECT TO public
  USING (true);

-- But we need to prevent credit_balance from leaking. Since RLS can't
-- do column-level security, we'll rely on the view for public access
-- and the application always using public_profiles for other users.
-- 
-- Actually this re-creates the same issue. Let me take a different approach:
-- Drop this policy and instead make the view SECURITY DEFINER with
-- a restricted owner, which is the standard pattern for views that
-- expose a subset of columns.

DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Revert to security_invoker = off (SECURITY DEFINER is needed here
-- because we want the view to bypass RLS to show public fields while
-- the underlying table restricts credit_balance to owners only)
ALTER VIEW public.public_profiles SET (security_invoker = off);
