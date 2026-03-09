
CREATE OR REPLACE FUNCTION public.protect_credit_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    -- Block direct changes from client roles (authenticated/anon).
    -- Allow changes from SECURITY DEFINER functions (current_user = postgres/supabase_admin)
    -- and service_role connections.
    IF current_user NOT IN ('postgres', 'supabase_admin')
       AND current_setting('role', true) NOT IN ('service_role', 'supabase_admin') THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
