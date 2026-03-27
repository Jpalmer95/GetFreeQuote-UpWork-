-- Enable Supabase Realtime for notifications, quotes, and messages tables
-- Run this in the Supabase SQL Editor

-- Add tables to the supabase_realtime publication
-- This is required for Supabase real-time subscriptions to work

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.quotes;
alter publication supabase_realtime add table public.messages;
