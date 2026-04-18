-- ============================================================
-- GetFreeQuote Platform - Complete Enhancement Migration
-- Adds all tables for: escrow, trust scores, structured quotes,
-- GPS tracking, surge pricing, group buys, pools, credits,
-- apprentices, analytics, subscriptions
-- ============================================================

-- ============================================================
-- 1. TRUST SCORES & ENHANCED REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
    license_verified BOOLEAN DEFAULT FALSE,
    license_score INTEGER DEFAULT 0 CHECK (license_score >= 0 AND license_score <= 25),
    insurance_verified BOOLEAN DEFAULT FALSE,
    insurance_score INTEGER DEFAULT 0 CHECK (insurance_score >= 0 AND insurance_score <= 20),
    insurance_expiry TIMESTAMPTZ,
    bond_verified BOOLEAN DEFAULT FALSE,
    review_score INTEGER DEFAULT 0 CHECK (review_score >= 0 AND review_score <= 20),
    review_count INTEGER DEFAULT 0,
    review_weighted_avg NUMERIC(3,2) DEFAULT 0,
    completion_rate NUMERIC(5,4) DEFAULT 0,
    completed_jobs INTEGER DEFAULT 0,
    cancelled_jobs INTEGER DEFAULT 0,
    response_time_score INTEGER DEFAULT 0 CHECK (response_time_score >= 0 AND response_time_score <= 10),
    avg_response_minutes INTEGER DEFAULT 0,
    dispute_score INTEGER DEFAULT 0 CHECK (dispute_score >= 0 AND dispute_score <= 10),
    disputes_total INTEGER DEFAULT 0,
    disputes_resolved INTEGER DEFAULT 0,
    fair_pricer_badge BOOLEAN DEFAULT FALSE,
    top_rated_badge BOOLEAN DEFAULT FALSE,
    veteran_badge BOOLEAN DEFAULT FALSE,
    fast_responder_badge BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id)
);

CREATE INDEX idx_trust_scores_vendor ON trust_scores(vendor_id);
CREATE INDEX idx_trust_scores_overall ON trust_scores(overall_score DESC);

-- Enhanced reviews
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS job_total_amount NUMERIC(12,2);
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS unhelpful_votes INTEGER DEFAULT 0;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS vendor_response TEXT;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS vendor_response_at TIMESTAMPTZ;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vendor_reviews ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- ============================================================
-- 2. LEAD QUALITY SCORES
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
    description_score INTEGER DEFAULT 0 CHECK (description_score >= 0 AND description_score <= 25),
    has_photos BOOLEAN DEFAULT FALSE,
    has_dimensions BOOLEAN DEFAULT FALSE,
    has_budget BOOLEAN DEFAULT FALSE,
    budget_realism INTEGER DEFAULT 0 CHECK (budget_realism >= 0 AND budget_realism <= 20),
    budget_range_low NUMERIC(12,2),
    budget_range_high NUMERIC(12,2),
    user_score INTEGER DEFAULT 0 CHECK (user_score >= 0 AND user_score <= 20),
    is_returning_user BOOLEAN DEFAULT FALSE,
    user_response_rate NUMERIC(5,4) DEFAULT 0,
    user_avg_rating NUMERIC(3,2) DEFAULT 0,
    urgency_score INTEGER DEFAULT 0 CHECK (urgency_score >= 0 AND urgency_score <= 15),
    location_score INTEGER DEFAULT 0 CHECK (location_score >= 0 AND location_score <= 10),
    competing_quotes INTEGER DEFAULT 0,
    estimated_close_time TEXT,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id)
);

CREATE INDEX idx_lead_quality_job ON lead_quality_scores(job_id);
CREATE INDEX idx_lead_quality_score ON lead_quality_scores(overall_score DESC);

-- ============================================================
-- 3. STRUCTURED QUOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS structured_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    materials_subtotal NUMERIC(12,2) DEFAULT 0,
    labor_subtotal NUMERIC(12,2) DEFAULT 0,
    permits_subtotal NUMERIC(12,2) DEFAULT 0,
    equipment_subtotal NUMERIC(12,2) DEFAULT 0,
    overhead_subtotal NUMERIC(12,2) DEFAULT 0,
    optional_addons NUMERIC(12,2) DEFAULT 0,
    discounts NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_schedule TEXT DEFAULT 'fifty_fifty',
    deposit_percent NUMERIC(5,2),
    warranty_description TEXT,
    warranty_duration_months INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quote_id)
);

CREATE TABLE IF NOT EXISTS quote_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structured_quote_id UUID NOT NULL REFERENCES structured_quotes(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('materials', 'labor', 'permits', 'equipment', 'overhead', 'add_on', 'discount', 'other')),
    name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'each',
    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    material_grade TEXT,
    labor_hours NUMERIC(8,2),
    labor_rate NUMERIC(8,2),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(structured_quote_id);

CREATE TABLE IF NOT EXISTS quote_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structured_quote_id UUID NOT NULL REFERENCES structured_quotes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    percentage_of_total NUMERIC(5,2) NOT NULL CHECK (percentage_of_total >= 0 AND percentage_of_total <= 100),
    estimated_days NUMERIC(8,2) DEFAULT 1,
    release_on_completion BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_quote_milestones_quote ON quote_milestones(structured_quote_id);

-- ============================================================
-- 4. ESCROW & PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    quote_id UUID NOT NULL REFERENCES quotes(id),
    payer_id UUID NOT NULL REFERENCES auth.users(id),
    payee_id UUID NOT NULL REFERENCES auth.users(id),
    total_amount NUMERIC(12,2) NOT NULL,
    funded_amount NUMERIC(12,2) DEFAULT 0,
    released_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'partial_released', 'released', 'disputed', 'refunded', 'expired')),
    funded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    dispute_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_escrow_job ON escrow_accounts(job_id);
CREATE INDEX idx_escrow_payer ON escrow_accounts(payer_id);
CREATE INDEX idx_escrow_payee ON escrow_accounts(payee_id);
CREATE INDEX idx_escrow_status ON escrow_accounts(status);

CREATE TABLE IF NOT EXISTS escrow_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'released', 'disputed')),
    proof_description TEXT,
    proof_photos TEXT[],
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_escrow_milestones_account ON escrow_milestones(escrow_account_id);

CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    filed_by UUID NOT NULL REFERENCES auth.users(id),
    filed_against UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_photos TEXT[],
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'escalated')),
    resolution TEXT,
    resolution_amount NUMERIC(12,2),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_escrow ON disputes(escrow_account_id);
CREATE INDEX idx_disputes_status ON disputes(status);

CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    escrow_account_id UUID REFERENCES escrow_accounts(id),
    from_user_id UUID NOT NULL REFERENCES auth.users(id),
    to_user_id UUID NOT NULL REFERENCES auth.users(id),
    amount NUMERIC(12,2) NOT NULL,
    fee NUMERIC(12,2) DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL,
    provider TEXT DEFAULT 'platform_escrow' CHECK (provider IN ('stripe', 'platform_escrow', 'smart_contract')),
    provider_transaction_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'milestone_release', 'final_payment', 'refund', 'factoring_advance')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_records_job ON payment_records(job_id);
CREATE INDEX idx_payment_records_from ON payment_records(from_user_id);
CREATE INDEX idx_payment_records_to ON payment_records(to_user_id);

-- ============================================================
-- 5. GPS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    vendor_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'en_route' CHECK (status IN ('en_route', 'arrived', 'working', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    estimated_arrival TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    completion_photos TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gps_tracking_job ON gps_tracking_sessions(job_id);
CREATE INDEX idx_gps_tracking_vendor ON gps_tracking_sessions(vendor_id);
CREATE INDEX idx_gps_tracking_status ON gps_tracking_sessions(status);

CREATE TABLE IF NOT EXISTS gps_route_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES gps_tracking_sessions(id) ON DELETE CASCADE,
    lat NUMERIC(10,7) NOT NULL,
    lng NUMERIC(10,7) NOT NULL,
    accuracy NUMERIC(8,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gps_route_session ON gps_route_points(session_id);

-- ============================================================
-- 6. SURGE PRICING
-- ============================================================

CREATE TABLE IF NOT EXISTS surge_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('gig_work', 'emergency', 'moving', 'delivery', 'labor')),
    geo_hash TEXT NOT NULL,
    current_multiplier NUMERIC(4,2) DEFAULT 1.0,
    demand_count INTEGER DEFAULT 0,
    supply_count INTEGER DEFAULT 0,
    demand_supply_ratio NUMERIC(8,2) DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'normal' CHECK (level IN ('normal', 'moderate', 'high', 'extreme')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(category, geo_hash)
);

CREATE INDEX idx_surge_states_category ON surge_states(category);
CREATE INDEX idx_surge_states_geohash ON surge_states(geo_hash);

-- ============================================================
-- 7. MATERIAL GROUP BUYS
-- ============================================================

CREATE TABLE IF NOT EXISTS material_group_buys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES auth.users(id),
    material_category TEXT NOT NULL,
    material_description TEXT NOT NULL,
    supplier_name TEXT,
    supplier_contact TEXT,
    retail_price_per_unit NUMERIC(12,2) NOT NULL,
    group_price_per_unit NUMERIC(12,2) NOT NULL,
    minimum_quantity INTEGER NOT NULL DEFAULT 1,
    current_quantity INTEGER DEFAULT 0,
    target_quantity INTEGER NOT NULL,
    savings_percent NUMERIC(5,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'gathering' CHECK (status IN ('gathering', 'confirmed', 'ordered', 'delivered', 'cancelled')),
    deadline TIMESTAMPTZ NOT NULL,
    delivery_date TIMESTAMPTZ,
    delivery_location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_buys_organizer ON material_group_buys(organizer_id);
CREATE INDEX idx_group_buys_status ON material_group_buys(status);
CREATE INDEX idx_group_buys_category ON material_group_buys(material_category);

CREATE TABLE IF NOT EXISTS group_buy_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_buy_id UUID NOT NULL REFERENCES material_group_buys(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES auth.users(id),
    vendor_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price NUMERIC(12,2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_buy_id, vendor_id)
);

CREATE INDEX idx_group_buy_participants_buy ON group_buy_participants(group_buy_id);
CREATE INDEX idx_group_buy_participants_vendor ON group_buy_participants(vendor_id);

-- ============================================================
-- 8. NEIGHBORHOOD POOLS
-- ============================================================

CREATE TABLE IF NOT EXISTS neighborhood_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    work_type TEXT NOT NULL,
    location TEXT NOT NULL,
    location_lat NUMERIC(10,7) NOT NULL,
    location_lng NUMERIC(10,7) NOT NULL,
    radius_miles NUMERIC(6,2) DEFAULT 5,
    organizer_id UUID NOT NULL REFERENCES auth.users(id),
    min_participants INTEGER NOT NULL DEFAULT 2,
    max_participants INTEGER NOT NULL DEFAULT 20,
    estimated_individual_cost NUMERIC(12,2) NOT NULL,
    estimated_pool_cost NUMERIC(12,2) NOT NULL,
    savings_percent NUMERIC(5,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'gathering' CHECK (status IN ('gathering', 'funded', 'contractor_selected', 'in_progress', 'completed', 'cancelled')),
    selected_vendor_id UUID REFERENCES auth.users(id),
    selected_quote_id UUID,
    deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pools_organizer ON neighborhood_pools(organizer_id);
CREATE INDEX idx_pools_status ON neighborhood_pools(status);
CREATE INDEX idx_pools_location ON neighborhood_pools USING gist (
    point(location_lng, location_lat)
);

CREATE TABLE IF NOT EXISTS pool_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES neighborhood_pools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_name TEXT NOT NULL,
    address TEXT NOT NULL,
    address_lat NUMERIC(10,7) NOT NULL,
    address_lng NUMERIC(10,7) NOT NULL,
    agreed_amount NUMERIC(12,2) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    special_requests TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_id, user_id)
);

CREATE INDEX idx_pool_participants_pool ON pool_participants(pool_id);
CREATE INDEX idx_pool_participants_user ON pool_participants(user_id);

-- ============================================================
-- 9. COMMUNITY CREDITS & VOLUNTEER HOURS
-- ============================================================

CREATE TABLE IF NOT EXISTS volunteer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    community_project_id UUID NOT NULL REFERENCES community_projects(id),
    hours_worked NUMERIC(8,2) NOT NULL,
    role TEXT NOT NULL DEFAULT 'general_labor',
    date TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES auth.users(id),
    credits_earned NUMERIC(8,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_volunteer_logs_user ON volunteer_logs(user_id);
CREATE INDEX idx_volunteer_logs_project ON volunteer_logs(community_project_id);

CREATE TABLE IF NOT EXISTS community_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    total_earned NUMERIC(10,2) DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    current_balance NUMERIC(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_community_credits_user ON community_credits(user_id);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount NUMERIC(10,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('volunteer_earned', 'referral_bonus', 'project_discount', 'expired')),
    description TEXT NOT NULL,
    related_project_id UUID,
    related_job_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Impact metrics for community projects
CREATE TABLE IF NOT EXISTS impact_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_project_id UUID NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
    residents_benefited INTEGER DEFAULT 0,
    square_feet_improved NUMERIC(12,2) DEFAULT 0,
    jobs_created INTEGER DEFAULT 0,
    volunteer_hours_total NUMERIC(10,2) DEFAULT 0,
    total_invested NUMERIC(12,2) DEFAULT 0,
    private_donations NUMERIC(12,2) DEFAULT 0,
    volunteer_value NUMERIC(12,2) DEFAULT 0,
    before_photos TEXT[],
    after_photos TEXT[],
    completion_percent NUMERIC(5,2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_project_id)
);

-- ============================================================
-- 10. APPRENTICE & MENTORSHIP
-- ============================================================

CREATE TABLE IF NOT EXISTS apprentice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    desired_trade TEXT NOT NULL,
    experience_level TEXT NOT NULL DEFAULT 'none' CHECK (experience_level IN ('none', 'some', 'formal_training')),
    certifications TEXT[],
    availability TEXT NOT NULL DEFAULT 'full_time' CHECK (availability IN ('full_time', 'part_time', 'weekends')),
    location_lat NUMERIC(10,7) NOT NULL,
    location_lng NUMERIC(10,7) NOT NULL,
    max_commute_miles NUMERIC(6,2) DEFAULT 25,
    status TEXT NOT NULL DEFAULT 'seeking' CHECK (status IN ('seeking', 'matched', 'active', 'completed', 'cancelled')),
    hours_logged NUMERIC(10,2) DEFAULT 0,
    hours_required NUMERIC(10,2) DEFAULT 2000,
    current_mentor_id UUID REFERENCES auth.users(id),
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_apprentice_profiles_trade ON apprentice_profiles(desired_trade);
CREATE INDEX idx_apprentice_profiles_status ON apprentice_profiles(status);
CREATE INDEX idx_apprentice_profiles_location ON apprentice_profiles USING gist (
    point(location_lng, location_lat)
);

CREATE TABLE IF NOT EXISTS mentor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id),
    vendor_name TEXT NOT NULL,
    trades_offered TEXT[] NOT NULL,
    max_apprentices INTEGER DEFAULT 2,
    current_apprentices INTEGER DEFAULT 0,
    hourly_rate_for_apprentice NUMERIC(8,2) NOT NULL,
    years_experience INTEGER NOT NULL,
    certified_to_teach BOOLEAN DEFAULT FALSE,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id)
);

CREATE INDEX idx_mentor_profiles_vendor ON mentor_profiles(vendor_id);

CREATE TABLE IF NOT EXISTS apprentice_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apprentice_id UUID NOT NULL REFERENCES apprentice_profiles(id),
    mentor_id UUID NOT NULL REFERENCES auth.users(id),
    job_id UUID REFERENCES jobs(id),
    date TIMESTAMPTZ DEFAULT NOW(),
    hours_worked NUMERIC(8,2) NOT NULL,
    skills_practiced TEXT[],
    mentor_notes TEXT,
    apprentice_notes TEXT,
    photos TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apprentice_logs_apprentice ON apprentice_logs(apprentice_id);
CREATE INDEX idx_apprentice_logs_mentor ON apprentice_logs(mentor_id);

-- ============================================================
-- 11. VENDOR SUBSCRIPTIONS & ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id),
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'elite')),
    bids_per_month INTEGER DEFAULT 5,
    bids_used_this_month INTEGER DEFAULT 0,
    unlimited_bids BOOLEAN DEFAULT FALSE,
    priority_matching BOOLEAN DEFAULT FALSE,
    analytics_dashboard BOOLEAN DEFAULT FALSE,
    lead_quality_scores BOOLEAN DEFAULT FALSE,
    bulk_bidding BOOLEAN DEFAULT FALSE,
    material_group_buying BOOLEAN DEFAULT FALSE,
    api_access BOOLEAN DEFAULT FALSE,
    featured_placement BOOLEAN DEFAULT FALSE,
    badge TEXT,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    renewal_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled')),
    monthly_price NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id)
);

CREATE INDEX idx_vendor_subscriptions_vendor ON vendor_subscriptions(vendor_id);
CREATE INDEX idx_vendor_subscriptions_tier ON vendor_subscriptions(tier);

-- Area benchmarks (materialized periodically)
CREATE TABLE IF NOT EXISTS area_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    subcategory TEXT,
    area TEXT NOT NULL,
    avg_bid_amount NUMERIC(12,2) DEFAULT 0,
    median_bid_amount NUMERIC(12,2) DEFAULT 0,
    avg_rating NUMERIC(3,2) DEFAULT 0,
    avg_response_time_minutes INTEGER DEFAULT 0,
    vendor_count INTEGER DEFAULT 0,
    jobs_per_month INTEGER DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_area_benchmarks_area ON area_benchmarks(area);
CREATE INDEX idx_area_benchmarks_category ON area_benchmarks(category);

-- Invoice factoring
CREATE TABLE IF NOT EXISTS factoring_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES auth.users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id),
    original_amount NUMERIC(12,2) NOT NULL,
    advance_amount NUMERIC(12,2) NOT NULL,
    fee_amount NUMERIC(12,2) NOT NULL,
    fee_percent NUMERIC(5,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'funded', 'repaid', 'denied')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    funded_at TIMESTAMPTZ,
    repaid_at TIMESTAMPTZ
);

CREATE INDEX idx_factoring_vendor ON factoring_requests(vendor_id);
CREATE INDEX idx_factoring_status ON factoring_requests(status);

-- ============================================================
-- 12. EMERGENCY REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'hvac', 'lockout', 'tree_removal', 'water_damage', 'other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    photos TEXT[],
    location_lat NUMERIC(10,7) NOT NULL,
    location_lng NUMERIC(10,7) NOT NULL,
    radius_miles NUMERIC(6,2) DEFAULT 15,
    max_response_minutes INTEGER DEFAULT 60,
    surge_multiplier NUMERIC(4,2) DEFAULT 1.0,
    notified_vendor_ids UUID[],
    accepted_vendor_id UUID REFERENCES auth.users(id),
    estimated_arrival TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'broadcasting' CHECK (status IN ('broadcasting', 'accepted', 'en_route', 'on_site', 'resolved', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_emergency_requests_status ON emergency_requests(status);
CREATE INDEX idx_emergency_requests_location ON emergency_requests USING gist (
    point(location_lng, location_lat)
);

-- ============================================================
-- 13. GIG BUNDLES
-- ============================================================

CREATE TABLE IF NOT EXISTS gig_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    total_estimated_value NUMERIC(12,2) DEFAULT 0,
    bundle_discount NUMERIC(5,2) DEFAULT 0,
    discounted_total NUMERIC(12,2) DEFAULT 0,
    location_lat NUMERIC(10,7) NOT NULL,
    location_lng NUMERIC(10,7) NOT NULL,
    preferred_vendor_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gig_bundle_jobs (
    bundle_id UUID NOT NULL REFERENCES gig_bundles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id),
    PRIMARY KEY (bundle_id, job_id)
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Trust scores: vendors can read their own, everyone can read
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_scores_read" ON trust_scores FOR SELECT USING (true);
CREATE POLICY "trust_scores_admin" ON trust_scores FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- Escrow: involved parties can read
ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escrow_read" ON escrow_accounts FOR SELECT USING (
    auth.uid() = payer_id OR auth.uid() = payee_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- GPS tracking: vendor and job poster can read
ALTER TABLE gps_tracking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gps_read" ON gps_tracking_sessions FOR SELECT USING (
    auth.uid() = vendor_id OR
    EXISTS (SELECT 1 FROM jobs WHERE id = gps_tracking_sessions.job_id AND user_id = auth.uid())
);

-- Community credits: users can read their own
ALTER TABLE community_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_read" ON community_credits FOR SELECT USING (auth.uid() = user_id);

-- Apprentice profiles: public read, own write
ALTER TABLE apprentice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apprentice_read" ON apprentice_profiles FOR SELECT USING (true);
CREATE POLICY "apprentice_write" ON apprentice_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_structured_quotes_updated BEFORE UPDATE ON structured_quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_escrow_updated BEFORE UPDATE ON escrow_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_group_buys_updated BEFORE UPDATE ON material_group_buys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pools_updated BEFORE UPDATE ON neighborhood_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_apprentice_updated BEFORE UPDATE ON apprentice_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON vendor_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create community credits on first volunteer log
CREATE OR REPLACE FUNCTION create_community_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO community_credits (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_volunteer_credits AFTER INSERT ON volunteer_logs
    FOR EACH ROW EXECUTE FUNCTION create_community_credits();

-- Auto-create vendor subscription on profile creation
CREATE OR REPLACE FUNCTION create_vendor_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO vendor_subscriptions (vendor_id, tier)
    VALUES (NEW.user_id, 'free')
    ON CONFLICT (vendor_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: trigger would go on vendor_profiles table if it exists
-- CREATE TRIGGER trg_vendor_sub AFTER INSERT ON vendor_profiles ...

-- ============================================================
-- DONE
-- ============================================================
