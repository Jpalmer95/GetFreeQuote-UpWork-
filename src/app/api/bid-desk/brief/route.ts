import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { getJobBrief, upsertJobBrief } from '@/services/bidDesk';

/**
 * GET  /api/bid-desk/brief?jobId=...  → the canonical Job Brief for a job
 * PUT  /api/bid-desk/brief           → create/update the Job Brief
 *   Body: { jobId, brief: { scope_structured, trades, budget_min, budget_max,
 *          timeline_start, timeline_end, must_haves, plans_attachments, notes } }
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 * The brief is the single source of truth the agent answers every contractor from.
 */
export async function GET(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobId = new URL(request.url).searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const brief = await getJobBrief(jobId);
    return NextResponse.json({ success: true, data: brief });
}

export async function PUT(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, brief } = await request.json();
    if (!jobId || !brief) return NextResponse.json({ error: 'jobId and brief required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const saved = await upsertJobBrief(jobId, brief);
    if (!saved) return NextResponse.json({ error: 'Failed to save job brief' }, { status: 500 });
    return NextResponse.json({ success: true, data: saved });
}
