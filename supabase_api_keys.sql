-- ============================================================================
-- GetFreeQuote — API keys table
-- APPLIED 2026-08-12 to the live Supabase project (was referenced by
-- /api/api-keys and /api/mcp but the table did not exist — the feature was
-- broken until this was created).
--
-- Key verification pattern (see /api/mcp and /api/oracle/feed):
--   raw key is `bfk_<hex>`; only the sha256 hex digest is stored in key_hash.
--   request_count / last_used_at are incremented on each authenticated call.
-- ============================================================================

create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null default '',
  scopes text[] not null default '{read}',
  request_count integer not null default 0,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.api_keys enable row level security;

create policy "Users can view their own api keys."
  on public.api_keys for select using (auth.uid() = user_id);

create policy "Users can create their own api keys."
  on public.api_keys for insert with check (auth.uid() = user_id);

create policy "Users can update their own api keys."
  on public.api_keys for update using (auth.uid() = user_id);

create policy "Users can delete their own api keys."
  on public.api_keys for delete using (auth.uid() = user_id);

create index if not exists api_keys_hash_idx on public.api_keys (key_hash);
