-- Create a table for proactive memory pings
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient cron polling
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_poll 
ON scheduled_messages (status, scheduled_at) 
WHERE status = 'pending';

-- Add RLS policies
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled messages"
    ON scheduled_messages FOR SELECT
    USING (auth.uid() = user_id);

-- Service role bypass is handled by the service_role key in backend
