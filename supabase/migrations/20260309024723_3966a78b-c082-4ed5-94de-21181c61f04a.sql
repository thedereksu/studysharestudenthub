
-- Fix security definer view by setting it to security invoker
ALTER VIEW public.public_profiles SET (security_invoker = on);
