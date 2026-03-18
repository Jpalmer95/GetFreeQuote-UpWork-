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
  accepted_quote_id uuid references public.quotes(id),
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
