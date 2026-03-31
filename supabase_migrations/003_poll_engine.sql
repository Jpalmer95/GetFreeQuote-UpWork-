-- Poll Engine Migration
-- Adds EXPIRED job status, poll_runs audit table, last_reminded_at on jobs,
-- and updates the notifications type constraint.

-- 1. Add EXPIRED to jobs status check
ALTER TABLE public.jobs
    DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_status_check CHECK (status IN (
        'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DRAFT'
    ));

-- 2. Add last_reminded_at column to jobs (used to ensure reminder is sent only once per job)
ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS last_reminded_at timestamp with time zone;

-- 3. Create poll_runs audit table
CREATE TABLE IF NOT EXISTS public.poll_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    run_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    duration_ms integer,
    jobs_scanned integer DEFAULT 0,
    jobs_expired integer DEFAULT 0,
    jobs_reminded integer DEFAULT 0,
    jobs_rematched integer DEFAULT 0,
    community_seeds integer DEFAULT 0,
    errors jsonb DEFAULT '[]'::jsonb,
    triggered_by text DEFAULT 'cron'
);

-- 4. Update notifications type constraint to include polling types
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'quote_ready', 'approval_needed', 'scope_change',
        'agent_summary', 'job_match', 'negotiation_update', 'milestone',
        'new_message', 'verification_update',
        'job_reminder', 'job_expired'
    ));

-- 5. Update agent_actions action_type constraint to include polling types
ALTER TABLE public.agent_actions
    DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;

ALTER TABLE public.agent_actions
    ADD CONSTRAINT agent_actions_action_type_check CHECK (action_type IN (
        'job_broadcast', 'vendor_match', 'auto_quote', 'clarification_sent',
        'clarification_received', 'scope_analysis', 'quote_comparison',
        'escalation', 'negotiation', 'auto_approve', 'auto_reject', 'owner_instruction',
        'job_expired', 'job_reminder', 'vendor_rematch'
    ));

-- 6. Index for polling queries (find stale OPEN jobs efficiently)
CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx ON public.jobs (status, created_at)
    WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS jobs_last_reminded_at_idx ON public.jobs (last_reminded_at)
    WHERE status = 'OPEN';

-- 7. Index for poll_runs (most recent first)
CREATE INDEX IF NOT EXISTS poll_runs_run_at_idx ON public.poll_runs (run_at DESC);
