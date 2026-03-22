-- Add flagged column to messages for nope-flagging training pipeline
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false;

-- Partial index for fast training data queries (only flagged rows)
CREATE INDEX IF NOT EXISTS idx_messages_flagged
ON public.messages(user_id, created_at DESC)
WHERE flagged = true;

-- Covering index for "fetch preceding assistant message" in correction handler
CREATE INDEX IF NOT EXISTS idx_messages_user_created
ON public.messages(user_id, created_at DESC);
