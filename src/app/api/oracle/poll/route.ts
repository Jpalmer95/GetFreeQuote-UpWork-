import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Oracle outbox poll endpoint (relay worker).
 *
 * Returns PENDING oracle_events for an external relay to relay to the paid
 * agent-oracle ingest endpoint, then marks them EMITTED. Guarded by an
 * ORACLE_POLL_SECRET so only your relay worker can drain the outbox.
 *
 * GET /api/oracle/poll?limit=50
 */
export async function GET(request: NextRequest) {
    const secret = process.env.ORACLE_POLL_SECRET;
    const auth = request.headers.get('authorization');
    if (!secret || auth !== `Bearer ${secret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const { data, error } = await supabaseAdmin
        .from('oracle_events')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(limit);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const ids = (data || []).map((e: any) => e.id);
    if (ids.length > 0) {
        await supabaseAdmin.from('oracle_events').update({ status: 'EMITTED', emitted_at: new Date().toISOString() }).in('id', ids);
    }

    return NextResponse.json({ success: true, data: data || [], count: ids.length });
}
