-- ============================================================
-- session_tags table
-- Stores inferred topic tags per conversation session.
-- Tags are derived from session summaries/messages client-side.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,       -- stable identifier (e.g. started_at ISO string)
  tag         TEXT NOT NULL,       -- e.g. "career", "habits", "relationships"
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, session_key, tag)
);

ALTER TABLE public.session_tags ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own tags
CREATE POLICY "Users can view own session tags"
  ON public.session_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session tags"
  ON public.session_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own session tags"
  ON public.session_tags FOR DELETE
  USING (auth.uid() = user_id);

-- Service role full access (used by API routes with service key)
CREATE POLICY "Service role full access on session_tags"
  ON public.session_tags FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_session_tags_user_id ON public.session_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON public.session_tags (user_id, tag);
