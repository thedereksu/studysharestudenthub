
-- Fix the protect_credit_balance trigger to allow SECURITY DEFINER functions to modify credit_balance
-- The issue: current_setting('role') returns 'authenticated' even inside SECURITY DEFINER functions,
-- so the trigger was blocking all credit operations done through RPC functions.
-- Fix: check current_user vs session_user. In SECURITY DEFINER functions, current_user is the function
-- owner (e.g. 'postgres'), while session_user remains the original caller.
CREATE OR REPLACE FUNCTION public.protect_credit_balance()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.credit_balance IS DISTINCT FROM OLD.credit_balance THEN
    -- Allow if running inside a SECURITY DEFINER function (current_user differs from session_user)
    -- or if called by service_role
    IF current_user = session_user
       AND current_setting('role', true) != 'service_role' THEN
      NEW.credit_balance := OLD.credit_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
