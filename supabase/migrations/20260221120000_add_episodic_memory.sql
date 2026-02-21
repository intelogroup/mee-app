
-- ============================================================
-- 1. Create Messages Table for Episodic Memory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on messages"
  ON public.messages FOR ALL
  USING (true) WITH CHECK (true);

-- Allow users to view their own messages
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. Add last_summary_at to Profiles
-- ============================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_summary_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 3. Indexing for Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_user_id_created_at 
ON public.messages(user_id, created_at DESC);
