
-- 1. Add unread counts to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS user1_unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user2_unread_count integer NOT NULL DEFAULT 0;

-- Allow participants to update their own conversation (to reset unread)
CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING ((auth.uid() = user1_id) OR (auth.uid() = user2_id))
  WITH CHECK ((auth.uid() = user1_id) OR (auth.uid() = user2_id));

-- Trigger to increment unread count on new message
CREATE OR REPLACE FUNCTION public.increment_unread_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations SET
    user1_unread_count = CASE WHEN user1_id = NEW.sender_id THEN user1_unread_count ELSE user1_unread_count + 1 END,
    user2_unread_count = CASE WHEN user2_id = NEW.sender_id THEN user2_unread_count ELSE user2_unread_count + 1 END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_insert_increment_unread
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_unread_on_message();

-- Enable realtime for conversations (for live unread updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- 2. User roles table (separate from profiles per security requirements)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read roles, users can read their own
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Admin audit log
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Only admins can view/insert audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.admin_actions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_actions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
