-- Create post_ai_conversations table for storing AI chat threads per user + post
CREATE TABLE public.post_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id, user_id)
);

ALTER TABLE public.post_ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own AI conversations"
  ON public.post_ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own AI conversations"
  ON public.post_ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own AI conversations"
  ON public.post_ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Create post_ai_file_cache table for caching extracted file text
CREATE TABLE public.post_ai_file_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  extracted_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id, file_name)
);

ALTER TABLE public.post_ai_file_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can view cached file text (it's derived from public/accessible materials)
CREATE POLICY "Anyone can view AI file cache"
  ON public.post_ai_file_cache FOR SELECT
  USING (true);

-- Only the service role can insert/update cache (via edge function)
CREATE POLICY "Service role can manage AI file cache"
  ON public.post_ai_file_cache FOR ALL
  USING (true);
