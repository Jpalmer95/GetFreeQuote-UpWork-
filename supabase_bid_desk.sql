-- ============================================================================
-- GetFreeQuote — Hermes Agent Bid Desk (Phase 0: Job Brief + Data Model)
-- Apply this in Supabase Dashboard > SQL Editor.
--
-- Adds the canonical "Job Brief" (single source of truth) plus a thread model
-- that maps ANY external channel (native inbox, email, SMS, Thumbtack browser
-- chat, voice) to a job, so the Hermes agent can answer every contractor from
-- one record and redistribute changes to all channels at once.
--
-- Design notes (see docs/plans/2026-08-13-hermes-agent-bid-desk.md):
--  * `bid_threads.channel` is an enum; external_thread_key is UNIQUE per channel
--    so an inbound email/SMS/Thumbtack message maps to exactly one thread.
--  * `bid_messages.direction` = in|out; `raw` keeps the untransformed payload;
--    `extracted_quote` is filled by the agent when a number/availability is found.
--  * `ranked_quotes` holds the agent's structured, comparable quote per thread.
--  * Owner reads via RLS; the Hermes agent writes via service_role (bypasses RLS),
--    matching the existing agent_* pattern. Agent actions are audited in the
--    existing public.agent_actions table.
-- ============================================================================

-- 1) JOB BRIEFS — one canonical record per job (single source of truth)
create table if not exists public.job_briefs (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  scope_structured jsonb default '{}'::jsonb,
  trades text[] default '{}',
  budget_min numeric,
  budget_max numeric,
  timeline_start date,
  timeline_end date,
  must_haves jsonb default '[]'::jsonb,
  plans_attachments text[] default '{}',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (job_id)
);

alter table public.job_briefs enable row level security;

create policy "Job briefs visible to job owner" on public.job_briefs
  for select using (
    exists (select 1 from public.jobs j where j.id = job_briefs.job_id and j.user_id = auth.uid())
  );
create policy "Job owner can create brief" on public.job_briefs
  for insert with check (
    exists (select 1 from public.jobs j where j.id = job_briefs.job_id and j.user_id = auth.uid())
  );
create policy "Job owner can update brief" on public.job_briefs
  for update using (
    exists (select 1 from public.jobs j where j.id = job_briefs.job_id and j.user_id = auth.uid())
  );

-- 2) BID THREADS — one row per external conversation, mapped to a job + channel
create type public.bid_channel as enum ('native', 'email', 'sms', 'thumbtack', 'voice');

create table if not exists public.bid_threads (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  channel public.bid_channel not null default 'native',
  external_thread_key text,
  contractor_contact jsonb default '{}'::jsonb,
  status text check (status in ('OPEN', 'AWAITING_OWNER', 'AWAITING_VENDOR', 'AWARDED', 'CLOSED')) default 'OPEN',
  last_activity_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (channel, external_thread_key)
);

alter table public.bid_threads enable row level security;

create policy "Bid threads visible to job owner" on public.bid_threads
  for select using (
    exists (select 1 from public.jobs j where j.id = bid_threads.job_id and j.user_id = auth.uid())
  );
create policy "Job owner can create thread" on public.bid_threads
  for insert with check (
    exists (select 1 from public.jobs j where j.id = bid_threads.job_id and j.user_id = auth.uid())
  );
create policy "Job owner can update thread" on public.bid_threads
  for update using (
    exists (select 1 from public.jobs j where j.id = bid_threads.job_id and j.user_id = auth.uid())
  );

-- 3) BID MESSAGES — normalized conversation across all channels
create table if not exists public.bid_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.bid_threads(id) on delete cascade not null,
  direction text check (direction in ('in', 'out')) not null,
  sender text not null,
  recipient text,
  body text not null,
  raw jsonb default '{}'::jsonb,
  extracted_quote jsonb,
  is_agent_action boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bid_messages enable row level security;

create policy "Bid messages visible to job owner" on public.bid_messages
  for select using (
    exists (
      select 1 from public.bid_threads bt
      join public.jobs j on j.id = bt.job_id
      where bt.id = bid_messages.thread_id and j.user_id = auth.uid()
    )
  );
-- Agent messages are inserted server-side via service_role (bypasses RLS),
-- matching the existing messages/agent_* pattern.

-- 4) RANKED QUOTES — the agent's structured, comparable quote per thread
create table if not exists public.ranked_quotes (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.bid_threads(id) on delete cascade not null,
  quote_amount numeric not null,
  estimated_days integer,
  start_availability date,
  exclusions text,
  license_verified boolean default false,
  coi_verified boolean default false,
  rating numeric,
  distance_mi numeric,
  rank integer,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (thread_id)
);

alter table public.ranked_quotes enable row level security;

create policy "Ranked quotes visible to job owner" on public.ranked_quotes
  for select using (
    exists (
      select 1 from public.bid_threads bt
      join public.jobs j on j.id = bt.job_id
      where bt.id = ranked_quotes.thread_id and j.user_id = auth.uid()
    )
  );
-- Agent writes via service_role (bypasses RLS).

-- 5) Helpers / indexes
create index if not exists bid_threads_job_idx on public.bid_threads(job_id);
create index if not exists bid_threads_channel_key_idx on public.bid_threads(channel, external_thread_key);
create index if not exists bid_messages_thread_idx on public.bid_messages(thread_id, created_at);

-- Touch updated_at on briefs + threads on message insert (best effort; agent
-- also updates these explicitly on redistribute).
create or replace function public.touch_bid_thread()
returns trigger language plpgsql as $$
begin
  update public.bid_threads
     set last_activity_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_bid_messages_touch on public.bid_messages;
create trigger trg_bid_messages_touch
  after insert on public.bid_messages
  for each row execute function public.touch_bid_thread();

-- The service_role key bypasses RLS, so no extra grant is needed for the route.
