-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/htiundwxiwwdkieevylu/sql/new

-- ============================================================
-- 1. Profiles table (extends Supabase Auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  is_active        BOOLEAN DEFAULT true,
  bot_linked_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Service role has full access (for bot webhook + admin)
CREATE POLICY "Service role full access"
  ON public.profiles FOR ALL
  USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Auto-create profile row when a new user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Backfill profile for existing user (jimkalinov@gmail.com)
-- ============================================================
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Enable Realtime on profiles (for live bot-link detection)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
