-- Enable Row Level Security
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- USERS / PROFILES (Managed by Supabase Auth, but we need a public profile table)
-- We will link to auth.users
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text check (role in ('USER', 'VENDOR', 'ADMIN')) default 'USER',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup automatically
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'USER'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
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
  budget text
);

alter table public.jobs enable row level security;

-- Policies for Jobs
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
  vendor_name text not null, -- Cache name for easier display, or join with profiles
  amount numeric not null,
  estimated_days integer not null,
  details text,
  status text check (status in ('PENDING', 'ACCEPTED', 'REJECTED')) default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.quotes enable row level security;

-- Policies for Quotes
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


-- MESSAGES
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) not null,
  sender_id uuid references public.profiles(id) not null, -- or 'SYSTEM' / 'AGENT' if handled specially, but FK enforces uuid. 
  -- IF we need SYSTEM messages, we might need to make sender_id nullable or handle differently.
  -- For now assuming all chat is user/vendor or agent-as-user.
  content text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  is_agent_action boolean default false
);

alter table public.messages enable row level security;

-- Policies for Messages
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

create policy "Users can insert messages." on public.messages
  for insert with check (
    auth.uid() = sender_id
  );
