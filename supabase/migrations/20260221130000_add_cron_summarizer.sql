-- ============================================================
-- Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1. Create a function to trigger the backend cron endpoint
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_episodic_summarizer()
RETURNS void AS $$
DECLARE
  -- TODO: Verify the exact Render URL in your dashboard (Render sometimes appends random strings)
  api_url text := 'https://mee-app-backend.onrender.com/api/telegram/cron/summarize';
  secret  text := 'mee-cron-secret-123';
BEGIN
  PERFORM net.http_post(
    url := api_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', secret
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Schedule the cron job (Every Hour)
-- ============================================================
-- Remove existing job if it exists to avoid duplicates
-- Using a subquery to avoid error if job doesn't exist
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'episodic-summary-cron';

-- Schedule new job
SELECT cron.schedule(
  'episodic-summary-cron', -- job name
  '0 * * * *',             -- cron schedule (every hour at minute 0)
  'SELECT public.trigger_episodic_summarizer()'
);
