import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { awardJobToThread } from '@/services/hireService';

/**
 * POST /api/bid-desk/award
 *   Body: { jobId, threadId, price?, durationDays?, notes? }
 *
 * Owner approves a winner → marks the thread AWARDED, closes all others with a
 * courtesy notice, flips the job to IN_PROGRESS, and delivers a one-page work
 * order to the chosen contractor. Price is taken from the ranked_quote for the
 * thread if present, else the optional `price` in the body.
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 */
export async function POST(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, threadId, price, durationDays } = await request.json();
    if (!jobId || !threadId) return NextResponse.json({ error: 'jobId and threadId required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: thread } = await supabaseAdmin.from('bid_threads').select('*').eq('id', threadId).single();
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const result = await awardJobToThread({ jobId, threadId, ownerName: caller.userId, price, durationDays: durationDays ?? null });
    if (!result.ok) return NextResponse.json({ error: result.error || 'Failed to award' }, { status: 500 });

    // Audit the award.
    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: caller.userId,
        action_type: 'award',
        summary: `Job awarded to thread ${threadId}${price ? ` at $${price}` : ''}`,
        details: { threadId, price, durationDays },
        automated: true,
    });

    return NextResponse.json({ success: true, data: result });
}
