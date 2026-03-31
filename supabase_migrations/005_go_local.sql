-- 005_go_local.sql  --  Hyperlocal "Go Local" support

-- Add local request columns to jobs (all nullable/backward-compatible)
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS is_local_request boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS location_lat numeric(10, 7),
    ADD COLUMN IF NOT EXISTS location_lng numeric(11, 7),
    ADD COLUMN IF NOT EXISTS radius_miles integer;

-- Indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_jobs_is_local ON jobs(is_local_request) WHERE is_local_request = true;
CREATE INDEX IF NOT EXISTS idx_jobs_local_coords ON jobs(location_lat, location_lng) WHERE is_local_request = true;

-- Haversine distance function (returns miles between two lat/lng points)
CREATE OR REPLACE FUNCTION haversine_miles(
    lat1 numeric, lng1 numeric,
    lat2 numeric, lng2 numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT
        3958.8 * 2 * asin(
            sqrt(
                pow(sin(radians(lat2 - lat1) / 2), 2) +
                cos(radians(lat1)) * cos(radians(lat2)) *
                pow(sin(radians(lng2 - lng1) / 2), 2)
            )
        )
$$;

-- Add location coordinates to vendor_profiles for haversine matching
ALTER TABLE vendor_profiles
    ADD COLUMN IF NOT EXISTS location_lat numeric(10, 7),
    ADD COLUMN IF NOT EXISTS location_lng numeric(11, 7);

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_coords ON vendor_profiles(location_lat, location_lng)
    WHERE location_lat IS NOT NULL;

-- RPC: local_jobs_by_distance
-- Returns local jobs within a given radius sorted by distance ascending.
-- Falls back gracefully when jobs have no coordinates (excludes them from distance sort).
CREATE OR REPLACE FUNCTION local_jobs_by_distance(
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
LANGUAGE sql
STABLE
AS $$
    SELECT
        j.id,
        j.user_id,
        j.title,
        j.category,
        j.description,
        j.location,
        j.status::text,
        j.created_at,
        j.tags,
        j.is_public,
        j.requires_permit,
        j.budget,
        j.industry_vertical::text,
        j.subcategory,
        j.urgency::text,
        j.is_local_request,
        j.location_lat,
        j.location_lng,
        j.radius_miles,
        haversine_miles(viewer_lat, viewer_lng, j.location_lat, j.location_lng) AS distance_miles
    FROM jobs j
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
