
-- Fix materials SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON public.materials;
CREATE POLICY "Materials are viewable by everyone"
  ON public.materials FOR SELECT
  USING (true);

-- Fix materials INSERT
DROP POLICY IF EXISTS "Users can insert their own materials" ON public.materials;
CREATE POLICY "Users can insert their own materials"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

-- Fix materials UPDATE
DROP POLICY IF EXISTS "Users can update their own materials" ON public.materials;
CREATE POLICY "Users can update their own materials"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploader_id);

-- Fix materials DELETE
DROP POLICY IF EXISTS "Users can delete their own materials" ON public.materials;
CREATE POLICY "Users can delete their own materials"
  ON public.materials FOR DELETE
  TO authenticated
  USING (auth.uid() = uploader_id);

-- Fix profiles SELECT
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Fix profiles INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix profiles UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Fix user_roles SELECT
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix comments SELECT
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

-- Fix comments INSERT
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
CREATE POLICY "Users can insert their own comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix comments UPDATE
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix comments DELETE
DROP POLICY IF EXISTS "Users can delete own comments or admin any" ON public.comments;
CREATE POLICY "Users can delete own comments or admin any"
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Fix reviews SELECT
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT
  USING (true);

-- Fix reviews INSERT
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
CREATE POLICY "Users can insert their own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Fix reviews UPDATE
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- Fix material_requests
DROP POLICY IF EXISTS "Anyone can view open requests" ON public.material_requests;
CREATE POLICY "Anyone can view open requests"
  ON public.material_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.material_requests;
CREATE POLICY "Admins can view all requests"
  ON public.material_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own requests" ON public.material_requests;
CREATE POLICY "Users can insert own requests"
  ON public.material_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_user_id);

DROP POLICY IF EXISTS "Users can update own requests" ON public.material_requests;
CREATE POLICY "Users can update own requests"
  ON public.material_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_user_id);

DROP POLICY IF EXISTS "Admins can delete requests" ON public.material_requests;
CREATE POLICY "Admins can delete requests"
  ON public.material_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Fix messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)));

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)));

-- Fix unlocks
DROP POLICY IF EXISTS "Users can view their own unlocks" ON public.unlocks;
CREATE POLICY "Users can view their own unlocks"
  ON public.unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own unlocks" ON public.unlocks;
CREATE POLICY "Users can insert their own unlocks"
  ON public.unlocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Fix credit_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can view all transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix notification_preferences
DROP POLICY IF EXISTS "Users can read own preferences" ON public.notification_preferences;
CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix badge_applications
DROP POLICY IF EXISTS "Users can view own badge applications" ON public.badge_applications;
CREATE POLICY "Users can view own badge applications"
  ON public.badge_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all badge applications" ON public.badge_applications;
CREATE POLICY "Admins can view all badge applications"
  ON public.badge_applications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own badge applications" ON public.badge_applications;
CREATE POLICY "Users can insert own badge applications"
  ON public.badge_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update badge applications" ON public.badge_applications;
CREATE POLICY "Admins can update badge applications"
  ON public.badge_applications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix reports
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix blocked_emails
DROP POLICY IF EXISTS "Admins can view blocked emails" ON public.blocked_emails;
CREATE POLICY "Admins can view blocked emails"
  ON public.blocked_emails FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert blocked emails" ON public.blocked_emails;
CREATE POLICY "Admins can insert blocked emails"
  ON public.blocked_emails FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete blocked emails" ON public.blocked_emails;
CREATE POLICY "Admins can delete blocked emails"
  ON public.blocked_emails FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Fix admin_actions
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_actions;
CREATE POLICY "Admins can view audit logs"
  ON public.admin_actions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_actions;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_actions FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
