ALTER TABLE public.profiles
ADD COLUMN credits INT NOT NULL DEFAULT 5,
ADD COLUMN last_credit_refresh DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create a function to refresh daily credits
CREATE OR REPLACE FUNCTION public.refresh_daily_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_credit_refresh IS DISTINCT FROM OLD.last_credit_refresh AND NEW.last_credit_refresh = CURRENT_DATE THEN
    -- Credits already refreshed today, do nothing
    RETURN NEW;
  END IF;

  IF NEW.last_credit_refresh < CURRENT_DATE THEN
    NEW.credits = OLD.credits + 5; -- Add daily allowance
    NEW.last_credit_refresh = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the refresh_daily_credits function before update
CREATE TRIGGER refresh_credits_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.refresh_daily_credits();

-- Create a trigger to call the refresh_daily_credits function before insert
CREATE TRIGGER refresh_credits_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.refresh_daily_credits();

-- Create a function to add credits to a user
CREATE OR REPLACE FUNCTION public.add_credits(user_id uuid, amount int)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET credits = credits + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
