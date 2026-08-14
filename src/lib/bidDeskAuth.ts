/**
 * Bid Desk Auth
 *
 * Bid-desk routes can be called two ways:
 *   1. The JOB OWNER via their Supabase session (reads/writes their own job data).
 *   2. The HERMES AGENT via an API key (Bearer bfk_...) issued through /api/api-keys.
 *
 * Agent calls write via supabaseAdmin (service_role) so they bypass RLS; the
 * owner's calls go through the same service but are authorized by ownership.
 * Returns the caller identity or null (→ caller should 401).
 */
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export interface BidDeskCaller {
    mode: 'user' | 'agent';
    userId: string;
}

async function authenticateAgent(request: NextRequest): Promise<string | null> {
    const auth = request.headers.get('authorization') || '';
    const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!rawKey || !rawKey.startsWith('bfk_')) return null;

    const hash = createHash('sha256').update(rawKey).digest('hex');
    const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, user_id, revoked_at, request_count')
        .eq('key_hash', hash)
        .maybeSingle();
    if (error || !data || data.revoked_at) return null;

    // Track usage (microtransaction billing foundation).
    await supabaseAdmin
        .from('api_keys')
        .update({ request_count: data.request_count ? data.request_count + 1 : 1, last_used_at: new Date().toISOString() })
        .eq('id', data.id);

    return data.user_id;
}

export async function getBidDeskCaller(request: NextRequest): Promise<BidDeskCaller | null> {
    const agentUserId = await authenticateAgent(request);
    if (agentUserId) return { mode: 'agent', userId: agentUserId };

    const user = await getAuthenticatedUser(request);
    if (user) return { mode: 'user', userId: user.id };

    return null;
}
