-- Poll Engine v2 Migration
-- Adds accepted_at to quotes (zombie detection on acceptance time, not creation time)
-- Adds funding_snapshot to poll_runs (true "crossed since last run" community seed detection)

-- 1. Add accepted_at column to quotes
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

-- Backfill: for any existing ACCEPTED quotes, set accepted_at = created_at as best estimate
UPDATE public.quotes
    SET accepted_at = created_at
    WHERE status = 'ACCEPTED' AND accepted_at IS NULL;

-- 2. Add funding_snapshot to poll_runs for community seed threshold tracking
ALTER TABLE public.poll_runs
    ADD COLUMN IF NOT EXISTS funding_snapshot jsonb DEFAULT '{}'::jsonb;

-- 3. Index for zombie detection (find ACCEPTED quotes by accepted_at)
CREATE INDEX IF NOT EXISTS quotes_accepted_at_idx ON public.quotes (accepted_at)
    WHERE status = 'ACCEPTED';
