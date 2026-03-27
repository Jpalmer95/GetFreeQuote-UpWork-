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
  job_id uuid references public.jobs(id),
  vendor_id uuid references public.profiles(id) not null,
  vendor_name text not null,
  amount numeric not null,
  estimated_days integer not null,
  details text,
  status text check (status in ('PENDING', 'ACCEPTED', 'REJECTED')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  phase_id uuid
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


-- VENDOR PROFILES
create table public.vendor_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null unique,
  company_name text not null,
  company_description text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  website text,
  logo_url text,
  service_areas text[] default '{}',
  industries text[] default '{}',
  specialties text[] default '{}',
  certifications text[] default '{}',
  insurance_details text,
  insurance_expiry date,
  license_number text,
  year_established integer,
  team_size integer default 1,
  portfolio_images text[] default '{}',
  portfolio_descriptions text[] default '{}',
  is_verified boolean default false,
  avg_rating numeric default 0,
  total_reviews integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.vendor_profiles enable row level security;

create policy "Vendor profiles are viewable by everyone." on public.vendor_profiles
  for select using (true);

create policy "Users can insert own vendor profile." on public.vendor_profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own vendor profile." on public.vendor_profiles
  for update using (auth.uid() = user_id);


-- ESTIMATING TEMPLATES
create table public.estimating_templates (
  id uuid default gen_random_uuid() primary key,
  vendor_profile_id uuid references public.vendor_profiles(id) not null,
  name text not null,
  service_category text not null,
  industry_vertical text not null default 'Other',
  line_items jsonb not null default '[]',
  labor_rate numeric not null default 0,
  material_markup_percent numeric not null default 0,
  minimum_charge numeric not null default 0,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.estimating_templates enable row level security;

create policy "Estimating templates are viewable by owner." on public.estimating_templates
  for select using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Users can insert own estimating templates." on public.estimating_templates
  for insert with check (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Users can update own estimating templates." on public.estimating_templates
  for update using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Users can delete own estimating templates." on public.estimating_templates
  for delete using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );


-- TEAM MEMBERS
create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  vendor_profile_id uuid references public.vendor_profiles(id) not null,
  user_id uuid references public.profiles(id),
  email text not null,
  name text not null,
  role text check (role in ('admin', 'estimator', 'field_worker')) not null default 'field_worker',
  is_active boolean default true,
  invited_at timestamp with time zone default timezone('utc'::text, now()) not null,
  accepted_at timestamp with time zone
);

alter table public.team_members enable row level security;

create policy "Team members viewable by vendor owner." on public.team_members
  for select using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Vendor owner can insert team members." on public.team_members
  for insert with check (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Vendor owner can update team members." on public.team_members
  for update using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );

create policy "Vendor owner can delete team members." on public.team_members
  for delete using (
    exists (
      select 1 from public.vendor_profiles
      where public.vendor_profiles.id = vendor_profile_id
      and public.vendor_profiles.user_id = auth.uid()
    )
  );


-- VENDOR REVIEWS (placeholder structure, review collection flow is out of scope)
create table public.vendor_reviews (
  id uuid default gen_random_uuid() primary key,
  vendor_profile_id uuid references public.vendor_profiles(id) not null,
  reviewer_id uuid references public.profiles(id) not null,
  reviewer_name text not null,
  job_id uuid references public.jobs(id) not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.vendor_reviews enable row level security;

create policy "Reviews are viewable by everyone." on public.vendor_reviews
  for select using (true);

create policy "Users can insert reviews for completed jobs." on public.vendor_reviews
  for insert with check (auth.uid() = reviewer_id);


-- PROJECTS (multi-phase project coordination)
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text not null default '',
  location text not null default '',
  industry_vertical text not null default 'Other',
  status text check (status in ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')) default 'PLANNING',
  total_budget numeric,
  start_date date,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

create policy "Users can view own projects." on public.projects
  for select using (auth.uid() = user_id);

create policy "Users can create projects." on public.projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update own projects." on public.projects
  for update using (auth.uid() = user_id);

create policy "Users can delete own projects." on public.projects
  for delete using (auth.uid() = user_id);


-- PROJECT PHASES (individual trades / sub-jobs within a project)
create table public.project_phases (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  description text not null default '',
  trade_category text not null default 'Other',
  status text check (status in ('NOT_STARTED', 'WAITING_QUOTES', 'QUOTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')) default 'NOT_STARTED',
  sort_order integer not null default 0,
  depends_on uuid[] default '{}',
  start_date date,
  end_date date,
  estimated_cost numeric,
  actual_cost numeric,
  accepted_quote_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.project_phases enable row level security;

create policy "Users can view phases of own projects." on public.project_phases
  for select using (
    exists (
      select 1 from public.projects
      where public.projects.id = project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can insert phases into own projects." on public.project_phases
  for insert with check (
    exists (
      select 1 from public.projects
      where public.projects.id = project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can update phases of own projects." on public.project_phases
  for update using (
    exists (
      select 1 from public.projects
      where public.projects.id = project_id
      and public.projects.user_id = auth.uid()
    )
  );

create policy "Users can delete phases of own projects." on public.project_phases
  for delete using (
    exists (
      select 1 from public.projects
      where public.projects.id = project_id
      and public.projects.user_id = auth.uid()
    )
  );

-- Deferred quotes policy (depends on project_phases table created above)
create policy "Project owners can view phase quotes." on public.quotes
  for select using (
    exists (
      select 1 from public.project_phases pp
      join public.projects p on p.id = pp.project_id
      where pp.id = quotes.phase_id
      and p.user_id = auth.uid()
    )
  );

-- Cross-referencing FKs (added after both tables exist to avoid circular dependency)
alter table public.quotes add constraint quotes_phase_id_fkey foreign key (phase_id) references public.project_phases(id);
alter table public.project_phases add constraint project_phases_accepted_quote_id_fkey foreign key (accepted_quote_id) references public.quotes(id);


-- COMMUNITY PROJECTS (public community improvement initiatives with transparent funding)
create table public.community_projects (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) not null,
  creator_name text not null,
  title text not null,
  description text not null default '',
  category text not null default 'Other',
  location text not null default '',
  goal_amount numeric not null default 0,
  current_funding numeric not null default 0,
  status text check (status in ('ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) default 'ACTIVE',
  image_url text,
  contract_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.community_projects enable row level security;

create policy "Community projects are viewable by everyone." on public.community_projects
  for select using (true);

create policy "Users can create community projects." on public.community_projects
  for insert with check (auth.uid() = creator_id);

create policy "Creators can update own community projects." on public.community_projects
  for update using (auth.uid() = creator_id);


-- DONATIONS (contributions to community projects)
create table public.donations (
  id uuid default gen_random_uuid() primary key,
  community_project_id uuid references public.community_projects(id) on delete cascade not null,
  donor_id uuid references public.profiles(id),
  donor_name text not null default 'Anonymous',
  amount numeric not null,
  is_anonymous boolean default false,
  transaction_hash text,
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.donations enable row level security;

create policy "Donations are viewable by everyone." on public.donations
  for select using (true);

create policy "Authenticated users can donate." on public.donations
  for insert with check (auth.uid() = donor_id);


-- COMMUNITY PROJECT UPDATES (progress reports from project creators)
create table public.community_project_updates (
  id uuid default gen_random_uuid() primary key,
  community_project_id uuid references public.community_projects(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  author_name text not null,
  title text not null,
  content text not null default '',
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.community_project_updates enable row level security;

create policy "Community project updates are viewable by everyone." on public.community_project_updates
  for select using (true);

create policy "Creators can post updates to own projects." on public.community_project_updates
  for insert with check (
    auth.uid() = author_id
    AND exists (
      select 1 from public.community_projects
      where public.community_projects.id = community_project_id
      and public.community_projects.creator_id = auth.uid()
    )
  );


-- LEDGER ENTRIES (transparent transaction log for community project funds)
create table public.ledger_entries (
  id uuid default gen_random_uuid() primary key,
  community_project_id uuid references public.community_projects(id) on delete cascade not null,
  type text check (type in ('DONATION', 'EXPENSE')) not null,
  amount numeric not null,
  description text not null,
  reference_id uuid,
  transaction_hash text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ledger_entries enable row level security;

create policy "Ledger entries are viewable by everyone." on public.ledger_entries
  for select using (true);

create policy "Ledger entries created by service role only." on public.ledger_entries
  for insert with check (false);


-- RPC: Atomic funding increment for community projects (prevents race conditions)
create or replace function public.increment_community_funding(p_project_id uuid, p_amount numeric)
returns void as $$
begin
  update public.community_projects
  set
    current_funding = current_funding + p_amount,
    status = case
      when (current_funding + p_amount) >= goal_amount then 'FUNDED'
      else status
    end,
    updated_at = now()
  where id = p_project_id;
end;
$$ language plpgsql security definer;

create or replace function public.process_donation(
  p_project_id uuid,
  p_donor_id uuid,
  p_donor_name text,
  p_amount numeric,
  p_is_anonymous boolean,
  p_tx_hash text,
  p_message text default null
)
returns uuid as $$
declare
  v_donation_id uuid;
  v_status text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Donation amount must be positive';
  end if;

  select status into v_status from public.community_projects where id = p_project_id for update;
  if v_status is null then
    raise exception 'Project not found';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'Project is not accepting donations';
  end if;

  insert into public.donations (community_project_id, donor_id, donor_name, amount, is_anonymous, transaction_hash, message)
  values (
    p_project_id,
    case when p_is_anonymous then null else p_donor_id end,
    case when p_is_anonymous then 'Anonymous' else p_donor_name end,
    p_amount,
    p_is_anonymous,
    p_tx_hash,
    p_message
  )
  returning id into v_donation_id;

  update public.community_projects
  set
    current_funding = current_funding + p_amount,
    status = case when (current_funding + p_amount) >= goal_amount then 'FUNDED' else status end,
    updated_at = now()
  where id = p_project_id;

  insert into public.ledger_entries (community_project_id, type, amount, description, reference_id, transaction_hash)
  values (
    p_project_id,
    'DONATION',
    p_amount,
    case when p_is_anonymous then 'Anonymous donation' else 'Donation from ' || p_donor_name end
      || case when p_message is not null and p_message <> '' then ': ' || p_message else '' end,
    v_donation_id,
    p_tx_hash
  );

  return v_donation_id;
end;
$$ language plpgsql security definer;

create or replace function public.record_community_expense(
  p_project_id uuid,
  p_creator_id uuid,
  p_amount numeric,
  p_description text
)
returns json as $$
declare
  v_current_funding numeric;
  v_total_expenses numeric;
  v_available numeric;
  v_tx_hash text;
  v_entry_id uuid;
  v_creator uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be positive';
  end if;

  select creator_id, current_funding into v_creator, v_current_funding
  from public.community_projects where id = p_project_id for update;

  if v_creator is null then
    raise exception 'Project not found';
  end if;
  if v_creator <> p_creator_id then
    raise exception 'Only the project creator can record expenses';
  end if;

  select coalesce(sum(amount), 0) into v_total_expenses
  from public.ledger_entries
  where community_project_id = p_project_id and type = 'EXPENSE';

  v_available := v_current_funding - v_total_expenses;
  if p_amount > v_available then
    raise exception 'Insufficient funds. Available: %, Requested: %', round(v_available, 2), round(p_amount, 2);
  end if;

  v_tx_hash := '0x' || encode(gen_random_bytes(16), 'hex');

  insert into public.ledger_entries (community_project_id, type, amount, description, transaction_hash)
  values (p_project_id, 'EXPENSE', p_amount, p_description, v_tx_hash)
  returning id into v_entry_id;

  return json_build_object('entryId', v_entry_id, 'txHash', v_tx_hash, 'availableBalance', v_available - p_amount);
end;
$$ language plpgsql security definer;


revoke execute on function public.process_donation(uuid, uuid, text, numeric, boolean, text, text) from public;
revoke execute on function public.record_community_expense(uuid, uuid, numeric, text) from public;

-- Cross-reference: Link jobs to community projects for marketplace integration
alter table public.jobs add column community_project_id uuid references public.community_projects(id);
