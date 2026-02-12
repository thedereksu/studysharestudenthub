
-- Fix 1: Add input validation to handle_new_user SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
  user_name := LEFT(TRIM(user_name), 100);
  
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, user_name);
  
  RETURN NEW;
END;
$$;

-- Fix 2: Add CHECK constraints on profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT name_length_check CHECK (char_length(name) <= 100),
  ADD CONSTRAINT school_length_check CHECK (char_length(school) <= 200),
  ADD CONSTRAINT bio_length_check CHECK (char_length(bio) <= 1000);

-- Fix 3: Add CHECK constraints on materials table
ALTER TABLE public.materials
  ADD CONSTRAINT title_length CHECK (char_length(title) <= 200),
  ADD CONSTRAINT title_not_empty CHECK (trim(title) != ''),
  ADD CONSTRAINT description_length CHECK (char_length(description) <= 5000),
  ADD CONSTRAINT subject_not_empty CHECK (trim(subject) != ''),
  ADD CONSTRAINT type_not_empty CHECK (trim(type) != ''),
  ADD CONSTRAINT valid_exchange_type CHECK (exchange_type IN ('Free', 'Trade', 'Paid')),
  ADD CONSTRAINT valid_subject CHECK (subject IN ('Biology', 'Chemistry', 'Mathematics', 'Physics', 'History', 'English', 'Computer Science', 'Economics', 'Other')),
  ADD CONSTRAINT valid_type CHECK (type IN ('Notes', 'Study Guide', 'Practice Problems', 'Summary', 'Exam Prep'));
