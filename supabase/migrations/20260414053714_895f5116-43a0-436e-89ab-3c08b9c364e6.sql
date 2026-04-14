-- Restore public read access to profiles so joins (e.g. materials → profiles) work for all users
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT TO public
  USING (true);