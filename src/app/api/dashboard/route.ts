import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

/**
 * GET /api/dashboard — everything the owner's desk needs in one round trip.
 *
 * Returns the caller's jobs, every quote received on those jobs, and their recent
 * notifications. Doing this server-side avoids an N+1 of per-job quote fetches and
 * keeps the RLS surface small (the caller only ever gets their own rows).
 */
export async function GET(request: NextRequest) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: jobs, error: jobsErr } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('user_id', caller.id)
        .order('created_at', { ascending: false });
    if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });

    const jobIds = (jobs || []).map(j => j.id as string);
    let quotes: Record<string, unknown>[] = [];
    if (jobIds.length > 0) {
        const { data: quoteRows, error: quoteErr } = await supabaseAdmin
            .from('quotes')
            .select('id, job_id, vendor_name, amount, estimated_days, details, status, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });
        if (quoteErr) return NextResponse.json({ error: quoteErr.message }, { status: 500 });
        quotes = quoteRows || [];
    }

    const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id, title, message, type, priority, job_id, read, created_at')
        .eq('user_id', caller.id)
        .order('created_at', { ascending: false })
        .limit(12);

    const { data: agentActions } = await supabaseAdmin
        .from('agent_actions')
        .select('id, job_id, action_type, summary, automated, created_at')
        .eq('user_id', caller.id)
        .order('created_at', { ascending: false })
        .limit(8);

    return NextResponse.json({
        success: true,
        data: {
            jobs: jobs || [],
            quotes,
            notifications: notifications || [],
            agentActions: agentActions || [],
        },
    });
}
