-- Migration: add referral_code and referred_by to profiles
-- PENDING: do NOT apply to live without owner approval

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for fast lookups by referral_code
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code);

-- Index for counting referrals (how many rows have referred_by = X)
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);
