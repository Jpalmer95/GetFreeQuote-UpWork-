-- ============================================================================
-- GetFreeQuote.org — Initial Seed Data for PostgreSQL 16
-- Idempotent seed so the marketplace, Go Local JIT feed, Tools, Community
-- Builds, Bid Desk, and Pattern 2 Verifiable Escrow work out of the box.
-- ============================================================================

INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner@getfreequote.org', crypt('GetFreeQuote2026!', gen_salt('bf')), '{"full_name":"Jonathan K.","role":"ADMIN"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'bids@hillcountryelectric.example', crypt('VendorPass2026!', gen_salt('bf')), '{"full_name":"Hill Country Electric & Solar","role":"VENDOR"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'dispatch@highlandplumbing.example', crypt('VendorPass2026!', gen_salt('bf')), '{"full_name":"Highland Lakes Plumbing Co.","role":"VENDOR"}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'estimates@lonestarframing.example', crypt('VendorPass2026!', gen_salt('bf')), '{"full_name":"Lone Star Concrete & Framing","role":"VENDOR"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'ADMIN', wallet_address = '0x71C...89A4' WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET role = 'VENDOR', wallet_address = '0xA4B...92C1' WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET role = 'VENDOR', wallet_address = '0xB8D...31F0' WHERE id = '33333333-3333-4333-8333-333333333333';
UPDATE public.profiles SET role = 'VENDOR', wallet_address = '0xC2E...77D9' WHERE id = '44444444-4444-4444-8444-444444444444';

INSERT INTO public.vendor_profiles (
  id, user_id, company_name, company_description, contact_email, contact_phone,
  service_areas, industries, specialties, certifications, insurance_details,
  license_number, year_established, team_size, is_verified, avg_rating, total_reviews,
  location_lat, location_lng, wallet_address
) VALUES
  (
    'a1111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'Hill Country Electric & Solar',
    'Master electrician team serving Austin, Marble Falls, and Horseshoe Bay. Panel upgrades, commercial 3-phase, EV chargers, and battery backup.',
    'bids@hillcountryelectric.example',
    '512-555-0142',
    ARRAY['Austin, TX', 'Marble Falls, TX', 'Horseshoe Bay, TX', 'Cottonwood Shores, TX'],
    ARRAY['Home Services', 'Commercial Construction', 'Trade Labor'],
    ARRAY['Electrical', 'Electrical Systems', 'Solar', 'Panel Upgrade'],
    ARRAY['TECL #39281', 'NABCEP Certified', 'OSHA 30'],
    '$2M General Liability + Workers Comp (COI verified)',
    'TECL-39281',
    2016, 6, true, 4.9, 28,
    30.5427, -98.2789, '0xA4B00000000000000000000000000000000092C1'
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'Highland Lakes Plumbing Co.',
    'Commercial & residential plumbing, grease traps, reverse-osmosis water lines, water heaters, and same-day emergency leak response.',
    'dispatch@highlandplumbing.example',
    '830-555-0198',
    ARRAY['Horseshoe Bay, TX', 'Cottonwood Shores, TX', 'Marble Falls, TX', 'Austin, TX'],
    ARRAY['Home Services', 'Commercial Construction', 'Gig Work'],
    ARRAY['Plumbing', 'Plumbing Systems', 'Water Heater', 'Emergency'],
    ARRAY['TSBPE Master Plumber #M-41022', 'Backflow Certified'],
    '$1M/$2M Commercial Liability',
    'M-41022',
    2014, 4, true, 4.8, 19,
    30.5582, -98.3324, '0xB8D00000000000000000000000000000000031F0'
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'Lone Star Concrete & Framing',
    'Slabs, driveways, park pavilions, retaining walls, structural steel/wood framing, and rapid roadside/equipment assistance.',
    'estimates@lonestarframing.example',
    '512-555-0177',
    ARRAY['Austin, TX', 'Horseshoe Bay, TX', 'Marble Falls, TX'],
    ARRAY['Commercial Construction', 'Trade Labor', 'Home Services', 'Gig Work'],
    ARRAY['Concrete & Foundation', 'Carpentry', 'General Contracting', 'Roadside Assistance', 'Landscaping'],
    ARRAY['ACI Flatwork Certified', 'OSHA 10'],
    '$2M Aggregate Commercial Policy',
    'GC-TX-88410',
    2018, 9, true, 4.7, 14,
    30.2672, -97.7431, '0xC2E00000000000000000000000000000000077D9'
  )
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.agent_configs (
  id, user_id, role, is_active, auto_respond, auto_quote, min_budget, max_budget,
  industries, specialties, max_distance, base_rate, communication_style, service_area, max_active_jobs
) VALUES
  (
    'b1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'customer', true, true, false, 50, 100000,
    ARRAY['Home Services', 'Commercial Construction', 'Gig Work', 'Trade Labor'],
    ARRAY[]::text[], 50, null, 'concise',
    ARRAY['Austin, TX', 'Horseshoe Bay, TX', 'Cottonwood Shores, TX'], 20
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'vendor', true, true, true, 100, 75000,
    ARRAY['Home Services', 'Commercial Construction', 'Trade Labor'],
    ARRAY['Electrical', 'Electrical Systems', 'Panel Upgrade'], 50, 95, 'professional',
    ARRAY['Austin, TX', 'Marble Falls, TX', 'Horseshoe Bay, TX', 'Cottonwood Shores, TX'], 10
  ),
  (
    'b3333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    'vendor', true, true, true, 75, 50000,
    ARRAY['Home Services', 'Commercial Construction', 'Gig Work'],
    ARRAY['Plumbing', 'Plumbing Systems'], 40, 110, 'friendly',
    ARRAY['Horseshoe Bay, TX', 'Cottonwood Shores, TX', 'Marble Falls, TX', 'Austin, TX'], 8
  ),
  (
    'b4444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444',
    'vendor', true, true, true, 40, 120000,
    ARRAY['Commercial Construction', 'Trade Labor', 'Home Services', 'Gig Work'],
    ARRAY['Concrete & Foundation', 'Carpentry', 'General Contracting', 'Roadside Assistance'], 60, 85, 'concise',
    ARRAY['Austin, TX', 'Horseshoe Bay, TX', 'Marble Falls, TX'], 12
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Community Project
INSERT INTO public.community_projects (
  id, creator_id, creator_name, title, description, category, location,
  goal_amount, current_funding, status, contract_address, chain_id, token_symbol
) VALUES
  (
    'c1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'Jonathan K.',
    'Cottonwood Shores Shade Pavilion & Dog Park Water Station',
    'Community-funded 20x30 steel shade pavilion, concrete pad, and frost-free dog water fountain at the neighborhood park. All bids ranked transparently by value; milestone escrow releases only upon verified completion photos.',
    'Parks & Recreation',
    'Cottonwood Shores, TX',
    12500, 12500, 'FUNDED',
    '0x8453000000000000000000000000000000c0ffee',
    8453, 'USDC'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Jobs (Commercial, Residential, Community Build, and Local JIT Bounties)
INSERT INTO public.jobs (
  id, user_id, title, category, description, location, status, tags, is_public,
  requires_permit, budget, industry_vertical, subcategory, urgency, square_footage,
  materials, community_project_id, is_local_request, location_lat, location_lng, radius_miles
) VALUES
  (
    'd1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '20x30 Park Shade Pavilion Concrete Slab & Plumbing Stub-Out',
    'Concrete & Foundation',
    'Pour 600 sqft 4-inch reinforced concrete pad with 4 pier footings for shade pavilion plus trenching 45 linear ft PEX water line for frost-free dog fountain.',
    'Cottonwood Shores, TX',
    'OPEN',
    ARRAY['Commercial Construction', 'Concrete & Foundation', 'community-funded', 'pavilion'],
    true, true, '$8,500 - $11,500', 'Commercial Construction', 'Concrete & Foundation',
    'within_month', '600', '3500 PSI fiber concrete, #4 rebar, 3/4 PEX',
    'c1111111-1111-4111-8111-111111111111', true, 30.5510, -98.3360, 25
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'JIT Urgent: Popped Trailer Tire on RM 2147 — Need Floor Jack & 1/2" Impact',
    'Roadside Assistance',
    'Tandem utility trailer has a flat on RM 2147 near Cottonwood Shores. Have the spare wheel ready, just need a 3-ton jack and 1/2-inch impact wrench (21mm socket) for 20 minutes.',
    'Cottonwood Shores, TX',
    'OPEN',
    ARRAY['Gig Work', 'Roadside Assistance', 'jit', 'urgent', 'tire'],
    true, false, '$75 bounty', 'Gig Work', 'Roadside Assistance',
    'urgent', null, null, null, true, 30.5525, -98.3340, 15
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    '200A Main Panel Upgrade + 60A Commercial Circuit Run',
    'Electrical',
    'Upgrade existing 150A panel to 200A Square D QO with whole-home surge protector and run one 60A 240V dedicated circuit 35 ft in EMT conduit.',
    'Horseshoe Bay, TX',
    'OPEN',
    ARRAY['Home Services', 'Electrical', 'panel-upgrade', '200A'],
    true, true, '$2,400 - $3,400', 'Home Services', 'Electrical',
    'within_week', '2200', 'Square D QO 200A panel, 6 AWG THHN, 3/4 EMT',
    null, true, 30.5427, -98.2789, 25
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Job Briefs
INSERT INTO public.job_briefs (id, job_id, scope_structured, trades, budget_min, budget_max, must_haves, notes)
VALUES
  (
    'e1111111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    '{"title":"20x30 Park Shade Pavilion Concrete Slab & Plumbing Stub-Out","scope":"600 sqft 4-inch slab + 4 pier footings + 45ft PEX trench"}'::jsonb,
    ARRAY['Concrete & Foundation', 'Plumbing'],
    8500, 11500,
    '["COI required","broom finish","pressure test water line"]'::jsonb,
    'Community funded build — best value contractor wins milestone escrow.'
  ),
  (
    'e3333333-3333-4333-8333-333333333333',
    'd3333333-3333-4333-8333-333333333333',
    '{"title":"200A Main Panel Upgrade + 60A Commercial Circuit Run","scope":"200A Square D QO panel + 35ft 60A circuit in EMT"}'::jsonb,
    ARRAY['Electrical'],
    2400, 3400,
    '["TECL license","permit included","same-day utility reconnect"]'::jsonb,
    'Owner agent answers panel photos and load calc questions automatically.'
  )
ON CONFLICT (job_id) DO NOTHING;

-- Seed Quotes + Bid Threads + Ranked Quotes
INSERT INTO public.quotes (id, job_id, vendor_id, vendor_name, amount, estimated_days, details, status)
VALUES
  (
    'f1111111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'Lone Star Concrete & Framing',
    9200, 4,
    'All-inclusive: 600 sqft 4" slab w/ #4 rebar on 18" centers, 4x 16"x36" pier footings, and 45ft PEX stub-out. Includes forming, pump, broom finish, and cleanup.',
    'PENDING'
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    'd1111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Highland Lakes Plumbing Co.',
    10450, 5,
    'Concrete sub + master plumber trenching, backflow preventer, and frost-free hydrant install. Excludes haul-off of excess caliche spoil.',
    'PENDING'
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    'd3333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    'Hill Country Electric & Solar',
    2750, 1,
    '200A Square D QO copper bus panel, SPD surge arrestor, 35ft 6 AWG THHN in 3/4" EMT, city permit + PEC disconnect/reconnect coordination included.',
    'PENDING'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bid_threads (id, job_id, channel, external_thread_key, contractor_contact, status)
VALUES
  (
    '91111111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    'native',
    'native:44444444-4444-4444-8444-444444444444',
    '{"name":"Lone Star Concrete & Framing","userId":"44444444-4444-4444-8444-444444444444","phone":"512-555-0177"}'::jsonb,
    'OPEN'
  ),
  (
    '92222222-2222-4222-8222-222222222222',
    'd1111111-1111-4111-8111-111111111111',
    'native',
    'native:33333333-3333-4333-8333-333333333333',
    '{"name":"Highland Lakes Plumbing Co.","userId":"33333333-3333-4333-8333-333333333333","phone":"830-555-0198"}'::jsonb,
    'OPEN'
  ),
  (
    '93333333-3333-4333-8333-333333333333',
    'd3333333-3333-4333-8333-333333333333',
    'native',
    'native:22222222-2222-4222-8222-222222222222',
    '{"name":"Hill Country Electric & Solar","userId":"22222222-2222-4222-8222-222222222222","phone":"512-555-0142"}'::jsonb,
    'OPEN'
  )
ON CONFLICT (channel, external_thread_key) DO NOTHING;

INSERT INTO public.ranked_quotes (thread_id, quote_amount, estimated_days, exclusions, license_verified, coi_verified, rating, distance_mi, rank, notes)
VALUES
  ('91111111-1111-4111-8111-111111111111', 9200, 4, null, true, true, 4.7, 8.2, 1, 'Best value — zero exclusions, verified ACI + $2M COI'),
  ('92222222-2222-4222-8222-222222222222', 10450, 5, 'Spoil haul-off excluded', true, true, 4.8, 3.1, 2, 'Includes backflow cert; excludes spoil haul-off'),
  ('93333333-3333-4333-8333-333333333333', 2750, 1, null, true, true, 4.9, 4.5, 1, 'TECL #39281 verified, 1-day turnaround')
ON CONFLICT (thread_id) DO NOTHING;

-- Seed JIT Tool Listings
INSERT INTO public.item_listings (
  id, owner_id, owner_name, item_name, category, description, listing_type,
  sell_price, rent_price_per_day, rent_price_per_week, deposit, location_text,
  location_lat, location_lng, radius_miles, status, is_active
) VALUES
  (
    '71111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'Lone Star Concrete & Framing',
    'Milwaukee M18 FUEL 1/2" High-Torque Impact Wrench + Deep Socket Set',
    'Tool',
    'Includes two 5.0Ah batteries, rapid charger, and 17mm-27mm impact sockets. Great for lug nuts, anchor bolts, or roadside tire swaps.',
    'RENT', null, 25, 95, 100, 'Cottonwood Shores / Marble Falls, TX',
    30.5510, -98.3360, 25, 'AVAILABLE', true
  ),
  (
    '72222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'Highland Lakes Plumbing Co.',
    'RIDGID ProPress 1/2" - 2" Copper & PEX Crimping Kit',
    'Tool',
    'Commercial ProPress jaws + battery charger. Available for half-day or full-day local trade rentals.',
    'RENT', null, 65, 250, 250, 'Horseshoe Bay, TX',
    30.5427, -98.2789, 30, 'AVAILABLE', true
  ),
  (
    '73333333-3333-4333-8333-333333333333',
    '22222222-2222-4222-8222-222222222222',
    'Hill Country Electric & Solar',
    'Honda EU2200i Inverter Generator (Ultra-Quiet)',
    'Equipment',
    'Starts first pull. Ideal for jobsite tools, mobile welding prep, or backup power.',
    'BOTH', 780, 45, 180, 150, 'Marble Falls, TX',
    30.5782, -98.2728, 30, 'AVAILABLE', true
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Donations & Hash-Chained Ledger for the Community Project
INSERT INTO public.donations (id, community_project_id, donor_id, donor_name, amount, is_anonymous, transaction_hash, message)
VALUES
  ('81111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Korstad Neighbors Fund', 7500, false, '0x8453a1b2c3d4e5f60123456789abcdef01234567', 'Seed grant for shade structure & slab'),
  ('82222222-2222-4222-8222-222222222222', 'c1111111-1111-4111-8111-111111111111', null, 'Lakeside Rotary & Dog Owners', 5000, false, '0x8453f6e5d4c3b2a1fedcba9876543210fedcba98', 'Matching contribution for water station + concrete')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ledger_entries (id, community_project_id, type, amount, description, reference_id, transaction_hash, prev_hash, receipt_hash)
VALUES
  (
    '83111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'DONATION', 7500,
    'Contribution from Korstad Neighbors Fund: Seed grant for shade structure & slab',
    '81111111-1111-4111-8111-111111111111',
    '0x8453a1b2c3d4e5f60123456789abcdef01234567',
    'GENESIS',
    encode(digest('GENESIS:DONATION:c1111111-1111-4111-8111-111111111111:7500:0x8453a1b2c3d4e5f60123456789abcdef01234567', 'sha256'), 'hex')
  ),
  (
    '83222222-2222-4222-8222-222222222222',
    'c1111111-1111-4111-8111-111111111111',
    'DONATION', 5000,
    'Contribution from Lakeside Rotary & Dog Owners: Matching contribution for water station + concrete',
    '82222222-2222-4222-8222-222222222222',
    '0x8453f6e5d4c3b2a1fedcba9876543210fedcba98',
    encode(digest('GENESIS:DONATION:c1111111-1111-4111-8111-111111111111:7500:0x8453a1b2c3d4e5f60123456789abcdef01234567', 'sha256'), 'hex'),
    encode(digest(encode(digest('GENESIS:DONATION:c1111111-1111-4111-8111-111111111111:7500:0x8453a1b2c3d4e5f60123456789abcdef01234567', 'sha256'), 'hex') || ':DONATION:c1111111-1111-4111-8111-111111111111:5000:0x8453f6e5d4c3b2a1fedcba9876543210fedcba98', 'sha256'), 'hex')
  )
ON CONFLICT (id) DO NOTHING;

-- Seed a Pattern 2 Non-Custodial Verifiable Escrow Account + Milestones
INSERT INTO public.escrow_accounts (
  id, job_id, community_project_id, quote_id, payer_id, payee_id,
  payer_wallet, payee_wallet, chain_id, token_symbol, contract_address,
  manifest_hash, total_amount, funded_amount, released_amount, status, funded_at
) VALUES
  (
    '99111111-1111-4111-8111-111111111111',
    'd1111111-1111-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'f1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    '0x71C00000000000000000000000000000000089A4',
    '0xC2E00000000000000000000000000000000077D9',
    8453, 'USDC', '0x8453000000000000000000000000000000c0ffee',
    encode(digest('d1111111-1111-4111-8111-111111111111:f1111111-1111-4111-8111-111111111111:9200:USDC:8453', 'sha256'), 'hex'),
    9200, 9200, 2760, 'partial_released', now() - interval '2 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.escrow_milestones (
  id, escrow_account_id, name, amount, status, proof_description,
  proof_hash, release_tx_hash, submitted_at, approved_at, released_at, approved_by, sort_order
) VALUES
  (
    '99211111-1111-4111-8111-111111111111',
    '99111111-1111-4111-8111-111111111111',
    'Milestone 1: Site Grading, Forms & 45ft PEX Trench (30%)',
    2760, 'released',
    'Forms staked to grade, 4 pier holes augered to 36", 3/4" PEX line pressure-tested at 100 PSI.',
    encode(digest('proof:99211111:100psi-verified', 'sha256'), 'hex'),
    '0x84539911aa22bb33cc44dd55ee66ff7788990011',
    now() - interval '2 days', now() - interval '1 day', now() - interval '1 day',
    '11111111-1111-4111-8111-111111111111', 1
  ),
  (
    '99222222-2222-4222-8222-222222222222',
    '99111111-1111-4111-8111-111111111111',
    'Milestone 2: Rebar Grid Inspection & 3500 PSI Concrete Pour (45%)',
    4140, 'submitted',
    '#4 rebar grid tied on 18" centers with chairs; 9 yards 3500 PSI fiber concrete poured and broom-finished.',
    encode(digest('proof:99222222:rebar-and-pour-complete', 'sha256'), 'hex'),
    null,
    now() - interval '4 hours', null, null, null, 2
  ),
  (
    '99233333-3333-4333-8333-333333333333',
    '99111111-1111-4111-8111-111111111111',
    'Milestone 3: Form Strip, Hydrant Hookup & Final Walkthrough (25%)',
    2300, 'pending',
    null, null, null, null, null, null, null, 3
  )
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to gfquser / roles
GRANT USAGE ON SCHEMA public, auth, storage TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth, storage TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, auth, storage TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO PUBLIC;
