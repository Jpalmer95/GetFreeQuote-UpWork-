-- Saved Searches table for vendors to save marketplace filter configurations
create table public.saved_searches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saved_searches enable row level security;

create policy "Users can view own saved searches." on public.saved_searches
  for select using (auth.uid() = user_id);

create policy "Users can insert own saved searches." on public.saved_searches
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own saved searches." on public.saved_searches
  for delete using (auth.uid() = user_id);
