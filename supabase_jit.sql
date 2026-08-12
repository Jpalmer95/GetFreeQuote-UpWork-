-- ============================================================================
-- GetFreeQuote — JIT Item/Tool Sharing (rent-or-sell)
-- Apply in Supabase Dashboard > SQL Editor to enable the JIT item-sharing gap.
-- After applying, the corresponding API/db code (added in the same commit)
-- becomes active. No payment engine here — buyers/sellers handle payment directly.
-- ============================================================================

create table if not exists public.item_listings (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) not null,
  owner_name text not null default '',
  item_name text not null,
  category text not null default 'Tool',
  description text not null default '',
  listing_type text check (listing_type in ('RENT', 'SELL', 'BOTH')) not null default 'RENT',
  sell_price numeric,
  rent_price_per_day numeric,
  rent_price_per_week numeric,
  deposit numeric default 0,
  available_from date,
  available_until date,
  location_text text not null default '',
  location_lat numeric,
  location_lng numeric,
  radius_miles numeric default 25,
  images text[] default '{}',
  status text check (status in ('AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE')) default 'AVAILABLE',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.item_listings enable row level security;

create policy "Item listings are viewable by everyone when active."
  on public.item_listings for select using (is_active = true or auth.uid() = owner_id);

create policy "Users can create their own item listings."
  on public.item_listings for insert with check (auth.uid() = owner_id);

create policy "Users can update their own item listings."
  on public.item_listings for update using (auth.uid() = owner_id);

create policy "Users can delete their own item listings."
  on public.item_listings for delete using (auth.uid() = owner_id);

-- Keep a coarse "nearby items" lookup useful for the JIT feed.
create index if not exists item_listings_status_idx on public.item_listings (status);
create index if not exists item_listings_category_idx on public.item_listings (category);
