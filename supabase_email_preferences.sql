-- Add email_preferences column to profiles table
-- Run this in the Supabase SQL Editor after the main schema

alter table public.profiles
  add column if not exists email_preferences jsonb default '{"quote_ready":true,"quote_accepted":true,"quote_rejected":true,"job_match":true,"agent_approval":true,"new_message":false}'::jsonb;

-- Add 'new_message' to notifications type constraint (for vendor message notifications)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('quote_ready','approval_needed','scope_change','agent_summary','job_match','negotiation_update','milestone','new_message'));
