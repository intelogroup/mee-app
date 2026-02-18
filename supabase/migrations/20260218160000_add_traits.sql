
-- Add traits column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS traits TEXT[] DEFAULT '{}';
