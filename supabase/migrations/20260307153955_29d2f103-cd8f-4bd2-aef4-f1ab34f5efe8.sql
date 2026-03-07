
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  reference_id text,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update only is_read on their own notifications
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  email_ratings boolean NOT NULL DEFAULT false,
  email_purchases boolean NOT NULL DEFAULT false,
  email_comments boolean NOT NULL DEFAULT false,
  email_messages boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: create notification on new review
CREATE OR REPLACE FUNCTION public.notify_on_review()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT uploader_id INTO v_owner_id FROM materials WHERE id = NEW.material_id;
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.reviewer_id THEN
    INSERT INTO notifications (user_id, type, reference_id, message)
    VALUES (v_owner_id, 'rating', NEW.material_id, 'Your material received a new rating.');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_review();

-- Trigger function: create notification on unlock/purchase
CREATE OR REPLACE FUNCTION public.notify_on_unlock()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT uploader_id INTO v_owner_id FROM materials WHERE id = NEW.material_id;
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, reference_id, message)
    VALUES (v_owner_id, 'purchase', NEW.material_id, 'Someone purchased your material.');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_unlock
  AFTER INSERT ON public.unlocks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_unlock();

-- Trigger function: create notification on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT uploader_id INTO v_owner_id FROM materials WHERE id = NEW.material_id;
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, reference_id, message)
    VALUES (v_owner_id, 'comment', NEW.material_id, 'Someone commented on your material.');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Trigger function: create notification on message
CREATE OR REPLACE FUNCTION public.notify_on_message()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_recipient_id uuid;
  v_conv record;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  IF v_conv.user1_id = NEW.sender_id THEN
    v_recipient_id := v_conv.user2_id;
  ELSE
    v_recipient_id := v_conv.user1_id;
  END IF;
  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, reference_id, message)
    VALUES (v_recipient_id, 'message', NEW.conversation_id, 'You received a new message.');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
