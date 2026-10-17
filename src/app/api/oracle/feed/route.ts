import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeIlike } from '@/lib/safeEval';

/**
 * Oracle Agent API — real-time needs feed.
 *
 * GET /api/oracle/feed?include=jobs,listings,projects,events
 *   &q=&industry=&urgency=&lat=&lng=&radiusMiles=&local=1
 *   Authorization: Bearer bfk_...
 */
function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

async function authenticate(request: NextRequest): Promise<{ userId: string; keyId: string } | { error: string; status: number }> {
    const auth = request.headers.get('authorization') || '';
    const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!rawKey) return { error: 'Missing API key (Bearer bfk_...)', status: 401 };

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, revoked_at, request_count')
        .eq('key_hash', hashKey(rawKey))
        .maybeSingle();

    if (error || !data) return { error: 'Invalid API key', status: 401 };
    if (data.revoked_at) return { error: 'API key revoked', status: 401 };

    await supabaseAdmin
        .from('api_keys')
        .update({ request_count: data.request_count ? data.request_count + 1 : 1, last_used_at: new Date().toISOString() })
        .eq('id', data.id);

    return { userId: data.user_id, keyId: data.id };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticate(request);
        if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

        const { searchParams } = new URL(request.url);
        const includeRaw = (searchParams.get('include') || 'jobs,listings,projects').split(',');
        const include = new Set(includeRaw.map((s: string) => s.trim()).filter(Boolean));
        const q = sanitizeIlike(searchParams.get('q') || '');
        const industry = searchParams.get('industry') || '';
        const urgency = searchParams.get('urgency') || '';
        const localOnly = searchParams.get('local') === '1' || searchParams.get('local') === 'true';
        const lat = Number(searchParams.get('lat'));
        const lng = Number(searchParams.get('lng'));
        const radiusMiles = Math.min(100, Math.max(1, Number(searchParams.get('radiusMiles')) || 25));
        const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

        const result: Record<string, unknown> = {
            fetchedAt: new Date().toISOString(),
            query: { q: q || null, industry: industry || null, urgency: urgency || null, localOnly, hasGeo, radiusMiles },
        };

        if (include.has('jobs')) {
            let query = supabaseAdmin
                .from('jobs')
                .select('id, title, category, industry_vertical, subcategory, location, urgency, budget, created_at, is_local_request, location_lat, location_lng, radius_miles')
                .eq('is_public', true)
                .eq('status', 'OPEN')
                .order('created_at', { ascending: false })
                .limit(100);
            if (industry) query = query.eq('industry_vertical', industry);
            if (urgency) query = query.eq('urgency', urgency);
            if (localOnly) query = query.eq('is_local_request', true);
            if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
            const { data, error } = await query;
            if (!error) {
                type JobRow = Record<string, unknown> & { distance_miles?: number | null };
                let jobs: JobRow[] = (data || []) as JobRow[];
                if (hasGeo) {
                    jobs = jobs
                        .map((row) => {
                            const jlat = Number(row.location_lat);
                            const jlng = Number(row.location_lng);
                            const dist = Number.isFinite(jlat) && Number.isFinite(jlng)
                                ? haversineMiles(lat, lng, jlat, jlng)
                                : null;
                            return { ...row, distance_miles: dist };
                        })
                        .filter((row) =>
                            row.distance_miles == null ? !localOnly : row.distance_miles <= radiusMiles
                        )
                        .sort((a, b) => (a.distance_miles ?? 1e9) - (b.distance_miles ?? 1e9));
                }
                result.jobs = jobs.slice(0, 50);
            }
        }

        if (include.has('listings')) {
            let query = supabaseAdmin
                .from('item_listings')
                .select('id, item_name, category, listing_type, sell_price, rent_price_per_day, location_text, location_lat, location_lng, status, created_at')
                .eq('is_active', true)
                .eq('status', 'AVAILABLE')
                .order('created_at', { ascending: false })
                .limit(100);
            if (q) query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%,location_text.ilike.%${q}%`);
            const { data, error } = await query;
            if (!error) {
                type ListingRow = Record<string, unknown> & { distance_miles?: number | null };
                let listings: ListingRow[] = (data || []) as ListingRow[];
                if (hasGeo) {
                    listings = listings
                        .map((row) => {
                            const jlat = Number(row.location_lat);
                            const jlng = Number(row.location_lng);
                            const dist = Number.isFinite(jlat) && Number.isFinite(jlng)
                                ? haversineMiles(lat, lng, jlat, jlng)
                                : null;
                            return { ...row, distance_miles: dist };
                        })
                        .filter((row) => row.distance_miles == null || row.distance_miles <= radiusMiles);
                }
                result.listings = listings.slice(0, 50);
            }
        }

        if (include.has('projects')) {
            let query = supabaseAdmin
                .from('community_projects')
                .select('id, title, category, location, goal_amount, current_funding, status, created_at')
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .limit(50);
            if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
            const { data, error } = await query;
            if (!error) result.projects = data;
        }

        if (include.has('events')) {
            const { data, error } = await supabaseAdmin
                .from('oracle_events').select('id, event_type, entity_type, entity_id, version, payload, created_at')
                .eq('status', 'EMITTED').order('created_at', { ascending: false }).limit(50);
            if (!error) result.events = data;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
