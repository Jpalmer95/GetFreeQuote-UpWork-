-- Enable Row Level Security
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- USERS / PROFILES (Managed by Supabase Auth, but we need a public profile table)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('USER', 'VENDOR', 'ADMIN')) default 'USER',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'USER'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- JOBS
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  category text not null,
  description text not null,
  location text not null,
  status text check (status in ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) default 'OPEN',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  tags text[] default '{}',
  is_public boolean default true,
  requires_permit boolean default false,
  budget text,
  industry_vertical text not null default 'Other',
  subcategory text not null default 'Other',
  urgency text check (urgency in ('flexible', 'within_month', 'within_week', 'urgent')) default 'flexible',
  square_footage text,
  materials text,
  attachments text[] default '{}',
  timeline_start date,
  timeline_end date
);

alter table public.jobs enable row level security;

create policy "Jobs are viewable by everyone if public." on public.jobs
  for select using (is_public = true or auth.uid() = user_id);

create policy "Users can create jobs." on public.jobs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own jobs." on public.jobs
  for update using (auth.uid() = user_id);


-- QUOTES
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) not null,
  vendor_id uuid references public.profiles(id) not null,
  vendor_name text not null,
  amount numeric not null,
  estimated_days integer not null,
  details text,
  status text check (status in ('PENDING', 'ACCEPTED', 'REJECTED')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.quotes enable row level security;

create policy "Vendors can view their own quotes." on public.quotes
  for select using (auth.uid() = vendor_id);

create policy "Job owners can view quotes for their jobs." on public.quotes
  for select using (
    exists (
      select 1 from public.jobs
      where public.jobs.id = quotes.job_id
      and public.jobs.user_id = auth.uid()
    )
  );

create policy "Vendors can create quotes." on public.quotes
  for insert with check (auth.uid() = vendor_id);

-- Note: Quote status updates and cross-user operations (auto-quoting by AI agents)
-- are performed server-side via supabaseAdmin (service_role), which bypasses RLS.


-- MESSAGES (sender_id is text to support AI agent IDs like 'customer-agent-xxx')
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) not null,
  sender_id text not null,
  sender_type text check (sender_type in ('user', 'vendor', 'customer_agent', 'vendor_agent', 'system')) default 'user',
  content text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  is_agent_action boolean default false
);

alter table public.messages enable row level security;

create policy "Users can view messages for their jobs." on public.messages
  for select using (
    exists (
      select 1 from public.jobs
      where public.jobs.id = messages.job_id
      and public.jobs.user_id = auth.uid()
    )
    OR
    exists (
      select 1 from public.quotes
      where public.quotes.job_id = messages.job_id
      and public.quotes.vendor_id = auth.uid()
    )
  );

create policy "Users can insert messages for their jobs." on public.messages
  for insert with check (
    sender_id = auth.uid()::text
    AND sender_type in ('user', 'vendor')
    AND (
      exists (
        select 1 from public.jobs
        where public.jobs.id = job_id
        and public.jobs.user_id = auth.uid()
      )
      OR exists (
        select 1 from public.quotes
        where public.quotes.job_id = job_id
        and public.quotes.vendor_id = auth.uid()
      )
    )
  );

-- Note: AI agent messages (sender_type = customer_agent/vendor_agent/system) are
-- inserted server-side via supabaseAdmin (service_role), which bypasses RLS.


-- AGENT CONFIGS
create table public.agent_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  role text check (role in ('customer', 'vendor')) not null default 'customer',
  is_active boolean default true,
  auto_respond boolean default true,
  auto_quote boolean default false,
  max_budget numeric,
  min_budget numeric,
  industries text[] default '{}',
  specialties text[] default '{}',
  max_distance integer,
  base_rate numeric,
  communication_style text check (communication_style in ('professional', 'friendly', 'concise')) default 'professional',
  escalation_triggers text[] default '{quote_received,scope_change,budget_exceeded}',
  auto_approve_below numeric,
  working_hours_only boolean default false,
  service_area text[] default '{}',
  max_active_jobs integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_configs enable row level security;

create policy "Users can view own agent config." on public.agent_configs
  for select using (auth.uid() = user_id);

create policy "Users can insert own agent config." on public.agent_configs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own agent config." on public.agent_configs
  for update using (auth.uid() = user_id);

-- Note: Vendor agent config lookups for job matching are performed server-side
-- via supabaseAdmin (service_role), which bypasses RLS.


-- AGENT ACTIONS (audit log of everything agents do)
create table public.agent_actions (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) not null,
  agent_config_id uuid references public.agent_configs(id),
  user_id uuid references public.profiles(id) not null,
  action_type text check (action_type in (
    'job_broadcast', 'vendor_match', 'auto_quote', 'clarification_sent',
    'clarification_received', 'scope_analysis', 'quote_comparison',
    'escalation', 'negotiation', 'auto_approve', 'auto_reject'
  )) not null,
  summary text not null,
  details jsonb default '{}',
  automated boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_actions enable row level security;

create policy "Users can view agent actions for their jobs." on public.agent_actions
  for select using (
    auth.uid() = user_id
    OR exists (
      select 1 from public.jobs
      where public.jobs.id = agent_actions.job_id
      and public.jobs.user_id = auth.uid()
    )
  );

create policy "Users can insert own agent actions." on public.agent_actions
  for insert with check (
    auth.uid() = user_id
    AND exists (
      select 1 from public.jobs
      where public.jobs.id = job_id
      and (
        public.jobs.user_id = auth.uid()
        OR exists (
          select 1 from public.quotes
          where public.quotes.job_id = public.jobs.id
          and public.quotes.vendor_id = auth.uid()
        )
      )
    )
  );

-- Note: Cross-user agent action logging is performed server-side via
-- supabaseAdmin (service_role), which bypasses RLS.


-- NOTIFICATIONS
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  job_id uuid references public.jobs(id),
  type text check (type in (
    'quote_ready', 'approval_needed', 'scope_change',
    'agent_summary', 'job_match', 'negotiation_update', 'milestone'
  )) not null,
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  title text not null,
  message text not null,
  read boolean default false,
  action_required boolean default false,
  action_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications." on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications." on public.notifications
  for update using (auth.uid() = user_id);

create policy "Users can insert own notifications." on public.notifications
  for insert with check (
    auth.uid() = user_id
    AND (
      job_id IS NULL
      OR exists (
        select 1 from public.jobs
        where public.jobs.id = job_id
        and (
          public.jobs.user_id = auth.uid()
          OR exists (
            select 1 from public.quotes
            where public.quotes.job_id = public.jobs.id
            and public.quotes.vendor_id = auth.uid()
          )
        )
      )
    )
  );

-- Note: System/agent notifications for other users are inserted server-side via
-- supabaseAdmin (service_role), which bypasses RLS.
