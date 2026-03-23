-- Add language preference to profiles
-- Stores the ISO 639-1 language code for the user's coaching language preference.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
