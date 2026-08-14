import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { redistributeToOpenThreads } from '@/services/bidDesk';

/**
 * POST /api/bid-desk/redistribute
 *   Body: { jobId, sender, body }
 *
 * The heart of the "update once, reach many" feature. Takes a single message
 * (a scope change, new detail, photo link, date move, etc.) and records it as
 * an outbound agent message to every OPEN / AWAITING_VENDOR thread for the job,
 * so the Hermes agent can then dispatch it through each channel's adapter
 * (email/SMS/Thumbtack browser/voice) in one action. Returns per-thread results
 * for the agent_actions audit log.
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 */
export async function POST(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, sender, body } = await request.json();
    if (!jobId || !sender || !body) return NextResponse.json({ error: 'jobId, sender, body required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results = await redistributeToOpenThreads(jobId, { sender, body });

    // Audit: record the redistribution as one agent action.
    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: caller.userId,
        action_type: 'redistribute',
        summary: `Redistributed update to ${results.filter(r => r.ok).length} open thread(s): ${body.substring(0, 120)}`,
        details: { body, threadResults: results },
        automated: true,
    });

    return NextResponse.json({ success: true, data: { dispatched: results.filter(r => r.ok).length, threads: results } });
}
