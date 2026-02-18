-- Add message_count column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Function to atomically increment message_count
CREATE OR REPLACE FUNCTION increment_message_count(row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET message_count = COALESCE(message_count, 0) + 1
  WHERE id = row_id;
END;
$$;