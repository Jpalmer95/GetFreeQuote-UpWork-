-- Add email_preferences column to profiles table
-- Run this in the Supabase SQL Editor after the main schema

alter table public.profiles
  add column if not exists email_preferences jsonb default '{"quote_ready":true,"quote_accepted":true,"quote_rejected":true,"job_match":true,"agent_approval":true,"new_message":false}'::jsonb;
