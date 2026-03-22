-- Add notification preference columns to profiles table
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS weekly_checkin_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS weekly_checkin_day INTEGER DEFAULT 1 CHECK (weekly_checkin_day >= 0 AND weekly_checkin_day <= 6),
    ADD COLUMN IF NOT EXISTS weekly_checkin_hour INTEGER DEFAULT 9 CHECK (weekly_checkin_hour >= 0 AND weekly_checkin_hour <= 23);

COMMENT ON COLUMN profiles.weekly_checkin_enabled IS 'Whether to send weekly check-in reminders via Telegram';
COMMENT ON COLUMN profiles.weekly_checkin_day IS 'Day of week for check-in (0=Sun, 1=Mon, ..., 6=Sat)';
COMMENT ON COLUMN profiles.weekly_checkin_hour IS 'Hour of day for check-in (0-23, user local time)';
