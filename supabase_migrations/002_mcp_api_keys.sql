-- MCP API Keys Migration
-- Run this against your Supabase project to enable external agent integrations via MCP.

-- 1. Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{"read","write"}',
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys." ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys." ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys." ON public.api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys." ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Add 'verification_update' to notifications type check if not already present
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'quote_ready', 'approval_needed', 'scope_change',
        'agent_summary', 'job_match', 'negotiation_update', 'milestone',
        'new_message', 'verification_update'
    ));

-- 3. Index for fast api key lookups
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys (key_hash) WHERE is_active = true;
