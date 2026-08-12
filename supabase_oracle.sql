-- ============================================================================
-- GetFreeQuote — Oracle Event Store (outbox for the paid agent-oracle)
-- Apply in Supabase Dashboard > SQL Editor to enable the oracle integration gap.
-- Design: every job/gig/JIT/negotiation emits a signed, versioned event here;
-- a worker relays PENDING rows to the configured oracle ingest endpoint
-- (L402-style microtransaction billing), then marks them EMITTED.
-- ============================================================================

create table if not exists public.oracle_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  version integer not null default 1,
  payload jsonb not null default '{}',
  signature text not null default '',
  nonce text,
  status text check (status in ('PENDING', 'EMITTED', 'FAILED')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  emitted_at timestamp with time zone
);

alter table public.oracle_events enable row level security;

-- Oracle events are written/read by server-side service role only.
create policy "Oracle events are not directly writable by clients."
  on public.oracle_events for all using (false) with check (false);

-- For poll_jobs / relay workers using service role (bypasses RLS), no grant needed.

create index if not exists oracle_events_status_idx on public.oracle_events (status);
create index if not exists oracle_events_entity_idx on public.oracle_events (entity_type, entity_id);
