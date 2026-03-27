-- VERIFICATION REQUESTS
-- Run this migration in the Supabase SQL Editor

create table if not exists public.verification_requests (
  id uuid default gen_random_uuid() primary key,
  vendor_profile_id uuid references public.vendor_profiles(id) not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending' not null,
  documents text[] default '{}',
  license_number text,
  insurance_details text,
  notes text,
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.verification_requests enable row level security;

create policy "Verification requests viewable by owner" on public.verification_requests
  for select using (
    vendor_profile_id in (
      select id from public.vendor_profiles where user_id = auth.uid()
    )
  );

create policy "Verification requests viewable by admins" on public.verification_requests
  for select using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'ADMIN'
    )
  );

create policy "Vendors can insert own verification request" on public.verification_requests
  for insert with check (
    vendor_profile_id in (
      select id from public.vendor_profiles where user_id = auth.uid()
    )
  );

-- Add verification_update to notification types
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'quote_ready', 'approval_needed', 'scope_change',
    'agent_summary', 'job_match', 'negotiation_update', 'milestone', 'new_message',
    'verification_update'
  ));
