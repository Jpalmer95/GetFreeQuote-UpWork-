-- Agent Hub Migration
-- Run this against your Supabase project to enable the Agent Hub features.

-- 1. Add push/SMS notification fields to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS phone_number text,
    ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- 2. Create agent_instructions table
CREATE TABLE IF NOT EXISTS public.agent_instructions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    instruction text NOT NULL,
    acknowledged boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agent_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instructions." ON public.agent_instructions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instructions." ON public.agent_instructions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instructions." ON public.agent_instructions
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Allow 'owner_instruction' action type and nullable job_id in agent_actions
ALTER TABLE public.agent_actions
    DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;

ALTER TABLE public.agent_actions
    ADD CONSTRAINT agent_actions_action_type_check CHECK (action_type IN (
        'job_broadcast', 'vendor_match', 'auto_quote', 'clarification_sent',
        'clarification_received', 'scope_analysis', 'quote_comparison',
        'escalation', 'negotiation', 'auto_approve', 'auto_reject', 'owner_instruction'
    ));

ALTER TABLE public.agent_actions
    ALTER COLUMN job_id DROP NOT NULL;

-- 4. Index for fast user-based agent_actions lookups
CREATE INDEX IF NOT EXISTS agent_actions_user_id_idx ON public.agent_actions (user_id, created_at DESC);

-- 5. Index for agent_instructions
CREATE INDEX IF NOT EXISTS agent_instructions_user_id_idx ON public.agent_instructions (user_id, created_at DESC);
