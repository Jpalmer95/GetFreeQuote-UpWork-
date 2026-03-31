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
