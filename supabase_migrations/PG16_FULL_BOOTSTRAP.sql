-- ============================================================================
-- GetFreeQuote.org — Self-Hosted PostgreSQL 16 Full Bootstrap Schema
-- Compatible with all Supabase migrations (001..006, bid_desk, jit, oracle,
-- reviews, api_keys, verification_requests, saved_searches) + Pattern 2
-- Non-Custodial Verifiable Milestone Escrow & Hash-Chained Audit Ledger.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Supabase-compatible roles & auth/storage schemas
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT true,
  allowed_mime_types text[]
);

INSERT INTO storage.buckets (id, name, public, allowed_mime_types) VALUES
  ('job-attachments', 'job-attachments', true, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('vendor-assets', 'vendor-assets', true, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('community-images', 'community-images', true, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text CHECK (role IN ('USER', 'VENDOR', 'ADMIN')) DEFAULT 'USER',
  avatar_url text,
  phone_number text,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT false,
  push_subscription jsonb,
  wallet_address text,
  email_preferences jsonb DEFAULT '{"quote_ready":true,"quote_accepted":true,"quote_rejected":true,"job_match":true,"agent_approval":true,"new_message":false,"verification_update":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Community Projects (created before jobs so jobs.community_project_id FK works)
CREATE TABLE IF NOT EXISTS public.community_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  creator_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  location text NOT NULL DEFAULT '',
  goal_amount numeric NOT NULL DEFAULT 0,
  current_funding numeric NOT NULL DEFAULT 0,
  status text CHECK (status IN ('ACTIVE', 'FUNDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')) DEFAULT 'ACTIVE',
  image_url text,
  contract_address text,
  chain_id integer DEFAULT 8453,
  token_symbol text DEFAULT 'USDC',
  awarded_job_id uuid,
  awarded_quote_id uuid,
  awarded_vendor_name text,
  escrow_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  status text CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DRAFT')) DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  tags text[] DEFAULT '{}',
  is_public boolean DEFAULT true,
  requires_permit boolean DEFAULT false,
  budget text,
  industry_vertical text NOT NULL DEFAULT 'Other',
  subcategory text NOT NULL DEFAULT 'Other',
  urgency text CHECK (urgency IN ('flexible', 'within_month', 'within_week', 'urgent')) DEFAULT 'flexible',
  square_footage text,
  materials text,
  attachments text[] DEFAULT '{}',
  timeline_start date,
  timeline_end date,
  community_project_id uuid REFERENCES public.community_projects(id) ON DELETE SET NULL,
  last_reminded_at timestamptz,
  is_local_request boolean NOT NULL DEFAULT false,
  location_lat numeric(10, 7),
  location_lng numeric(11, 7),
  radius_miles integer
);

-- 5. Projects & Phases
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  industry_vertical text NOT NULL DEFAULT 'Other',
  status text CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')) DEFAULT 'PLANNING',
  total_budget numeric,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  trade_category text NOT NULL DEFAULT 'Other',
  status text CHECK (status IN ('NOT_STARTED', 'WAITING_QUOTES', 'QUOTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')) DEFAULT 'NOT_STARTED',
  sort_order integer NOT NULL DEFAULT 0,
  depends_on uuid[] DEFAULT '{}',
  start_date date,
  end_date date,
  estimated_cost numeric,
  actual_cost numeric,
  accepted_quote_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.profiles(id),
  vendor_name text NOT NULL,
  amount numeric NOT NULL,
  estimated_days integer NOT NULL,
  details text,
  status text CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL
);

-- 7. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_type text CHECK (sender_type IN ('user', 'vendor', 'customer_agent', 'vendor_agent', 'system')) DEFAULT 'user',
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  is_agent_action boolean DEFAULT false
);

-- 8. Agent Configs, Actions & Instructions
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('customer', 'vendor')) NOT NULL DEFAULT 'customer',
  is_active boolean DEFAULT true,
  auto_respond boolean DEFAULT true,
  auto_quote boolean DEFAULT false,
  max_budget numeric,
  min_budget numeric,
  industries text[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',
  max_distance integer,
  base_rate numeric,
  communication_style text CHECK (communication_style IN ('professional', 'friendly', 'concise')) DEFAULT 'professional',
  escalation_triggers text[] DEFAULT '{quote_received,scope_change,budget_exceeded}',
  auto_approve_below numeric,
  working_hours_only boolean DEFAULT false,
  service_area text[] DEFAULT '{}',
  max_active_jobs integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  agent_config_id uuid REFERENCES public.agent_configs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  summary text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  automated boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instruction text NOT NULL,
  acknowledged boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  type text NOT NULL,
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  action_required boolean DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Vendor Profiles, Templates, Team, Reviews, Verification
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  company_description text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  website text,
  logo_url text,
  service_areas text[] DEFAULT '{}',
  industries text[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  insurance_details text,
  insurance_expiry date,
  license_number text,
  year_established integer,
  team_size integer DEFAULT 1,
  portfolio_images text[] DEFAULT '{}',
  portfolio_descriptions text[] DEFAULT '{}',
  is_verified boolean DEFAULT false,
  avg_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  location_lat numeric(10, 7),
  location_lng numeric(11, 7),
  wallet_address text,
  payment_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estimating_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_category text NOT NULL,
  industry_vertical text NOT NULL DEFAULT 'Other',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  labor_rate numeric NOT NULL DEFAULT 0,
  material_markup_percent numeric NOT NULL DEFAULT 0,
  minimum_charge numeric NOT NULL DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text NOT NULL,
  role text CHECK (role IN ('admin', 'estimator', 'field_worker')) NOT NULL DEFAULT 'field_worker',
  is_active boolean DEFAULT true,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  job_total_amount numeric(12,2),
  verified boolean DEFAULT false,
  helpful_votes integer DEFAULT 0,
  unhelpful_votes integer DEFAULT 0,
  vendor_response text,
  vendor_response_at timestamptz,
  category text,
  subcategory text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
  documents text[] DEFAULT '{}',
  license_number text,
  insurance_details text,
  notes text,
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Donations, Updates & Hash-Chained Ledger Entries
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_project_id uuid NOT NULL REFERENCES public.community_projects(id) ON DELETE CASCADE,
  donor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  donor_name text NOT NULL DEFAULT 'Anonymous',
  amount numeric NOT NULL,
  is_anonymous boolean DEFAULT false,
  transaction_hash text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_project_id uuid NOT NULL REFERENCES public.community_projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_project_id uuid NOT NULL REFERENCES public.community_projects(id) ON DELETE CASCADE,
  type text CHECK (type IN ('DONATION', 'EXPENSE')) NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  reference_id uuid,
  transaction_hash text,
  prev_hash text,
  receipt_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. Saved Searches, API Keys, Poll Runs, JIT Items, Oracle Events
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL DEFAULT '',
  scopes text[] NOT NULL DEFAULT '{read}',
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  request_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  jobs_scanned integer DEFAULT 0,
  jobs_expired integer DEFAULT 0,
  reminders_sent integer DEFAULT 0,
  vendor_rematches integer DEFAULT 0,
  community_seeds integer DEFAULT 0,
  funding_snapshot jsonb DEFAULT '{}'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  triggered_by text DEFAULT 'cron'
);

CREATE TABLE IF NOT EXISTS public.item_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT '',
  item_name text NOT NULL,
  category text NOT NULL DEFAULT 'Tool',
  description text NOT NULL DEFAULT '',
  listing_type text CHECK (listing_type IN ('RENT', 'SELL', 'BOTH')) NOT NULL DEFAULT 'RENT',
  sell_price numeric,
  rent_price_per_day numeric,
  rent_price_per_week numeric,
  deposit numeric DEFAULT 0,
  available_from date,
  available_until date,
  location_text text NOT NULL DEFAULT '',
  location_lat numeric,
  location_lng numeric,
  radius_miles numeric DEFAULT 25,
  images text[] DEFAULT '{}',
  status text CHECK (status IN ('AVAILABLE', 'RENTED', 'SOLD', 'UNAVAILABLE')) DEFAULT 'AVAILABLE',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oracle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature text NOT NULL DEFAULT '',
  nonce text,
  status text CHECK (status IN ('PENDING', 'EMITTED', 'FAILED')) DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  emitted_at timestamptz
);

-- 13. Bid Desk Tables (Job Briefs, Threads, Messages, Ranked Quotes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_channel') THEN
    CREATE TYPE public.bid_channel AS ENUM ('native', 'email', 'sms', 'thumbtack', 'voice');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.job_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  scope_structured jsonb DEFAULT '{}'::jsonb,
  trades text[] DEFAULT '{}',
  budget_min numeric,
  budget_max numeric,
  timeline_start date,
  timeline_end date,
  must_haves jsonb DEFAULT '[]'::jsonb,
  plans_attachments text[] DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bid_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  channel public.bid_channel NOT NULL DEFAULT 'native',
  external_thread_key text,
  contractor_contact jsonb DEFAULT '{}'::jsonb,
  status text CHECK (status IN ('OPEN', 'AWAITING_OWNER', 'AWAITING_VENDOR', 'AWARDED', 'CLOSED')) DEFAULT 'OPEN',
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_thread_key)
);

CREATE TABLE IF NOT EXISTS public.bid_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.bid_threads(id) ON DELETE CASCADE,
  direction text CHECK (direction IN ('in', 'out')) NOT NULL,
  sender text NOT NULL,
  recipient text,
  body text NOT NULL,
  raw jsonb DEFAULT '{}'::jsonb,
  extracted_quote jsonb,
  is_agent_action boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ranked_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL UNIQUE REFERENCES public.bid_threads(id) ON DELETE CASCADE,
  quote_amount numeric NOT NULL,
  estimated_days integer,
  start_availability date,
  exclusions text,
  license_verified boolean DEFAULT false,
  coi_verified boolean DEFAULT false,
  rating numeric,
  distance_mi numeric,
  rank integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_bid_thread()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.bid_threads SET last_activity_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bid_messages_touch ON public.bid_messages;
CREATE TRIGGER trg_bid_messages_touch
  AFTER INSERT ON public.bid_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_bid_thread();

-- 14. Pattern 2 Non-Custodial Verifiable Milestone Escrow & Audit Chain
CREATE TABLE IF NOT EXISTS public.escrow_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  community_project_id uuid REFERENCES public.community_projects(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  payer_id uuid NOT NULL REFERENCES public.profiles(id),
  payee_id uuid NOT NULL REFERENCES public.profiles(id),
  payer_wallet text,
  payee_wallet text,
  chain_id integer NOT NULL DEFAULT 8453,
  token_symbol text NOT NULL DEFAULT 'USDC',
  contract_address text,
  manifest_hash text NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  funded_amount numeric(12,2) DEFAULT 0,
  released_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'partial_released', 'released', 'disputed', 'refunded', 'expired')),
  funded_at timestamptz,
  completed_at timestamptz,
  dispute_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escrow_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id uuid NOT NULL REFERENCES public.escrow_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'released', 'disputed')),
  proof_description text,
  proof_photos text[] DEFAULT '{}',
  proof_hash text,
  release_tx_hash text,
  submitted_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  sort_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.verifiable_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id uuid REFERENCES public.escrow_accounts(id) ON DELETE CASCADE,
  community_project_id uuid REFERENCES public.community_projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  seq integer NOT NULL DEFAULT 1,
  action_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount numeric(12,2) DEFAULT 0,
  tx_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash text NOT NULL DEFAULT 'GENESIS',
  receipt_hash text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 15. Spatial & RPC Functions
CREATE OR REPLACE FUNCTION public.haversine_miles(
    lat1 numeric, lng1 numeric,
    lat2 numeric, lng2 numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT
        3958.8 * 2 * asin(
            least(1.0, sqrt(
                pow(sin(radians(lat2 - lat1) / 2), 2) +
                cos(radians(lat1)) * cos(radians(lat2)) *
                pow(sin(radians(lng2 - lng1) / 2), 2)
            ))
        )::numeric
$$;

CREATE OR REPLACE FUNCTION public.local_jobs_by_distance(
    viewer_lat numeric,
    viewer_lng numeric,
    radius_filter integer DEFAULT 25,
    industry_filter text DEFAULT NULL,
    urgency_filter text DEFAULT NULL,
    page_offset integer DEFAULT 0,
    page_limit integer DEFAULT 12
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    category text,
    description text,
    location text,
    status text,
    created_at timestamptz,
    tags text[],
    is_public boolean,
    requires_permit boolean,
    budget text,
    industry_vertical text,
    subcategory text,
    urgency text,
    is_local_request boolean,
    location_lat numeric,
    location_lng numeric,
    radius_miles integer,
    distance_miles double precision
)
LANGUAGE sql STABLE
AS $$
    SELECT
        j.id, j.user_id, j.title, j.category, j.description, j.location,
        j.status::text, j.created_at, j.tags, j.is_public, j.requires_permit,
        j.budget, j.industry_vertical::text, j.subcategory, j.urgency::text,
        j.is_local_request, j.location_lat, j.location_lng, j.radius_miles,
        haversine_miles(viewer_lat, viewer_lng, j.location_lat, j.location_lng)::double precision AS distance_miles
    FROM public.jobs j
    WHERE
        j.is_local_request = true
        AND j.status = 'OPEN'
        AND j.is_public = true
        AND j.location_lat IS NOT NULL
        AND j.location_lng IS NOT NULL
        AND haversine_miles(viewer_lat, viewer_lng, j.location_lat, j.location_lng) <= radius_filter
        AND (industry_filter IS NULL OR j.industry_vertical::text = industry_filter)
        AND (urgency_filter IS NULL OR j.urgency::text = urgency_filter)
    ORDER BY distance_miles ASC
    LIMIT page_limit
    OFFSET page_offset;
$$;

CREATE OR REPLACE FUNCTION public.process_donation(
  p_project_id uuid,
  p_donor_id uuid,
  p_donor_name text,
  p_amount numeric,
  p_is_anonymous boolean,
  p_tx_hash text,
  p_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_donation_id uuid;
  v_status text;
  v_prev_hash text;
  v_receipt_hash text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  SELECT status INTO v_status FROM public.community_projects WHERE id = p_project_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF v_status NOT IN ('ACTIVE', 'FUNDED') THEN
    RAISE EXCEPTION 'Project is not accepting donations';
  END IF;

  INSERT INTO public.donations (community_project_id, donor_id, donor_name, amount, is_anonymous, transaction_hash, message)
  VALUES (
    p_project_id,
    CASE WHEN p_is_anonymous THEN NULL ELSE p_donor_id END,
    CASE WHEN p_is_anonymous THEN 'Anonymous' ELSE p_donor_name END,
    p_amount,
    p_is_anonymous,
    p_tx_hash,
    p_message
  )
  RETURNING id INTO v_donation_id;

  UPDATE public.community_projects
  SET
    current_funding = current_funding + p_amount,
    status = CASE WHEN (current_funding + p_amount) >= goal_amount AND status = 'ACTIVE' THEN 'FUNDED' ELSE status END,
    updated_at = now()
  WHERE id = p_project_id;

  SELECT COALESCE(receipt_hash, 'GENESIS') INTO v_prev_hash
  FROM public.ledger_entries
  WHERE community_project_id = p_project_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_prev_hash IS NULL THEN v_prev_hash := 'GENESIS'; END IF;

  v_receipt_hash := encode(digest(v_prev_hash || ':DONATION:' || p_project_id::text || ':' || p_amount::text || ':' || COALESCE(p_tx_hash, ''), 'sha256'), 'hex');

  INSERT INTO public.ledger_entries (community_project_id, type, amount, description, reference_id, transaction_hash, prev_hash, receipt_hash)
  VALUES (
    p_project_id,
    'DONATION',
    p_amount,
    CASE WHEN p_is_anonymous THEN 'Anonymous contribution' ELSE 'Contribution from ' || p_donor_name END
      || CASE WHEN p_message IS NOT NULL AND p_message <> '' THEN ': ' || p_message ELSE '' END,
    v_donation_id,
    p_tx_hash,
    v_prev_hash,
    v_receipt_hash
  );

  RETURN v_donation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_community_expense(
  p_project_id uuid,
  p_creator_id uuid,
  p_amount numeric,
  p_description text
)
RETURNS json AS $$
DECLARE
  v_current_funding numeric;
  v_total_expenses numeric;
  v_available numeric;
  v_tx_hash text;
  v_entry_id uuid;
  v_creator uuid;
  v_prev_hash text;
  v_receipt_hash text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be positive';
  END IF;

  SELECT creator_id, current_funding INTO v_creator, v_current_funding
  FROM public.community_projects WHERE id = p_project_id FOR UPDATE;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF v_creator <> p_creator_id THEN
    RAISE EXCEPTION 'Only the project creator can record expenses';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_total_expenses
  FROM public.ledger_entries
  WHERE community_project_id = p_project_id AND type = 'EXPENSE';

  v_available := v_current_funding - v_total_expenses;
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Insufficient funds. Available: %, Requested: %', round(v_available, 2), round(p_amount, 2);
  END IF;

  SELECT COALESCE(receipt_hash, 'GENESIS') INTO v_prev_hash
  FROM public.ledger_entries
  WHERE community_project_id = p_project_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_prev_hash IS NULL THEN v_prev_hash := 'GENESIS'; END IF;

  v_tx_hash := '0x' || encode(gen_random_bytes(16), 'hex');
  v_receipt_hash := encode(digest(v_prev_hash || ':EXPENSE:' || p_project_id::text || ':' || p_amount::text || ':' || v_tx_hash, 'sha256'), 'hex');

  INSERT INTO public.ledger_entries (community_project_id, type, amount, description, transaction_hash, prev_hash, receipt_hash)
  VALUES (p_project_id, 'EXPENSE', p_amount, p_description, v_tx_hash, v_prev_hash, v_receipt_hash)
  RETURNING id INTO v_entry_id;

  RETURN json_build_object(
    'entryId', v_entry_id,
    'txHash', v_tx_hash,
    'prevHash', v_prev_hash,
    'receiptHash', v_receipt_hash,
    'availableBalance', v_available - p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.submit_vendor_review(
  p_vendor_profile_id uuid,
  p_reviewer_id uuid,
  p_reviewer_name text,
  p_job_id uuid,
  p_rating integer,
  p_comment text
)
RETURNS public.vendor_reviews
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_review public.vendor_reviews;
  v_new_avg numeric;
  v_count integer;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.id = p_vendor_profile_id AND vp.user_id = p_reviewer_id
  ) THEN
    RAISE EXCEPTION 'You cannot review your own vendor profile';
  END IF;

  INSERT INTO public.vendor_reviews
    (vendor_profile_id, reviewer_id, reviewer_name, job_id, rating, comment)
  VALUES
    (p_vendor_profile_id, p_reviewer_id, p_reviewer_name, p_job_id, p_rating, COALESCE(p_comment, ''))
  RETURNING * INTO v_review;

  SELECT avg(rating), count(*)
    INTO v_new_avg, v_count
  FROM public.vendor_reviews
  WHERE vendor_profile_id = p_vendor_profile_id;

  UPDATE public.vendor_profiles
  SET avg_rating = round(COALESCE(v_new_avg, 0)::numeric, 2),
      total_reviews = v_count,
      updated_at = now()
  WHERE id = p_vendor_profile_id;

  RETURN v_review;
END;
$$;
