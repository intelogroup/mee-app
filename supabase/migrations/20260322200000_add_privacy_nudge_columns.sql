-- Add data_collection_enabled, nudge_enabled, and last_nudge_sent columns to profiles table
-- These support the privacy controls and re-engagement nudge features.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS data_collection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS nudge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_nudge_sent TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.data_collection_enabled IS 'Whether the user allows AI to collect and analyse their conversation data';
COMMENT ON COLUMN public.profiles.nudge_enabled IS 'Whether the bot may send re-engagement nudges after inactivity';
COMMENT ON COLUMN public.profiles.last_nudge_sent IS 'Timestamp of the last nudge message sent to this user';
