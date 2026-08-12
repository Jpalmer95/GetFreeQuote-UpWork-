import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Oracle Agent API — real-time needs feed.
 *
 * Lets any agent poll the live demand/opportunity surface cheaply. Auth is an
 * API key issued via /api/api-keys (Bearer bfk_...). Usage is counted on the
 * key for future microtransaction billing (L402-style).
 *
 * GET /api/oracle/feed?include=jobs,listings,projects,events
 *   Authorization: Bearer bfk_...
 */
function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

async function authenticate(request: NextRequest): Promise<{ userId: string; keyId: string } | { error: string; status: number }> {
    const auth = request.headers.get('authorization') || '';
    const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!rawKey) return { error: 'Missing API key (Bearer bfk_...)', status: 401 };

    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, revoked_at')
        .eq('key_hash', hashKey(rawKey))
        .maybeSingle();

    if (error || !data) return { error: 'Invalid API key', status: 401 };
    if (data.revoked_at) return { error: 'API key revoked', status: 401 };

    // Track usage (foundation for microtransaction billing).
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

        const result: Record<string, unknown> = { fetchedAt: new Date().toISOString() };

        if (include.has('jobs')) {
            const { data, error } = await supabaseAdmin
                .from('jobs').select('id, title, category, industry_vertical, location, urgency, budget, created_at')
                .eq('is_public', true).eq('status', 'OPEN').order('created_at', { ascending: false }).limit(50);
            if (!error) result.jobs = data;
        }

        if (include.has('listings')) {
            const { data, error } = await supabaseAdmin
                .from('item_listings').select('id, item_name, category, listing_type, sell_price, rent_price_per_day, location_text, status, created_at')
                .eq('is_active', true).eq('status', 'AVAILABLE').order('created_at', { ascending: false }).limit(50);
            if (!error) result.listings = data;
        }

        if (include.has('projects')) {
            const { data, error } = await supabaseAdmin
                .from('community_projects').select('id, title, category, location, goal_amount, current_funding, status, created_at')
                .eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(50);
            if (!error) result.projects = data;
        }

        if (include.has('events')) {
            const { data, error } = await supabaseAdmin
                .from('oracle_events').select('id, event_type, entity_type, entity_id, version, payload, created_at')
                .eq('status', 'EMITTED').order('created_at', { ascending: false }).limit(50);
            if (!error) result.events = data;
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
