-- ============================================================
-- Coaching Goals table
-- Users set 1-3 coaching goals via the web app.
-- The bot references these to steer conversations.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coaching_goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL CHECK (char_length(title) <= 200),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.coaching_goals ENABLE ROW LEVEL SECURITY;

-- Service role full access (backend uses service key)
CREATE POLICY "Service role full access on coaching_goals"
  ON public.coaching_goals FOR ALL
  USING (true) WITH CHECK (true);

-- Users can view their own goals
CREATE POLICY "Users can view own goals"
  ON public.coaching_goals FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_coaching_goals_user_id
  ON public.coaching_goals (user_id);

-- Enforce max 3 active goals per user via a partial unique constraint approach
-- We use a trigger instead since partial unique constraints can't enforce counts
CREATE OR REPLACE FUNCTION check_max_active_goals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM public.coaching_goals
  WHERE user_id = NEW.user_id AND status = 'active';

  IF active_count >= 3 AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'Maximum of 3 active coaching goals allowed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_active_goals
  BEFORE INSERT ON public.coaching_goals
  FOR EACH ROW EXECUTE FUNCTION check_max_active_goals();
