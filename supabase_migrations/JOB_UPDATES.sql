-- Live job updates: the job brief's edit log.
--
-- Every clarification, scope change, photo/video note or schedule move is appended here and
-- shown on the public job page. Bidders read the same source of truth, and the owning agent
-- redistributes the change to every open bid thread. Nothing is edited in place, so a quote
-- can always be traced to the brief revision it was priced against.

CREATE TABLE IF NOT EXISTS public.job_updates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name text,
    kind        text NOT NULL DEFAULT 'clarification'
                CHECK (kind IN ('clarification', 'scope_change', 'schedule', 'media', 'status')),
    body        text NOT NULL,
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_updates_job_id_created_at_idx
    ON public.job_updates (job_id, created_at DESC);

COMMENT ON TABLE public.job_updates IS
    'Append-only clarification/change log for a job. Public read; owner or agent writes.';
