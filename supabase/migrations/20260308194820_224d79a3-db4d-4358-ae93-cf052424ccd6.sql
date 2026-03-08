
-- 1. Prevent direct credit_balance modifications via a trigger
CREATE OR REPLACE FUNCTION public.protect_credit_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow credit_balance changes from SECURITY DEFINER functions (superuser/service role)
  -- When called from RLS-enforced client context, block credit_balance changes
  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    -- Check if the caller is the actual user (not a trusted server function)
    IF current_setting('role', true) != 'service_role' 
       AND auth.uid() = OLD.id THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_credit_balance_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_credit_balance();

-- 2. Drop the dangerous two-parameter unlock_material overload
DROP FUNCTION IF EXISTS public.unlock_material(uuid, uuid);

-- 3. Make the materials storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'materials';

-- Drop public SELECT policy on storage if it exists
DROP POLICY IF EXISTS "Anyone can view material files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
