import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { listThreadsForJob, getOrCreateThread } from '@/services/bidDesk';
import type { BidChannel } from '@/types';

/**
 * GET  /api/bid-desk/threads?jobId=...  → all bid threads for a job
 * POST /api/bid-desk/threads            → open (or return) a thread for a job
 *   Body: { jobId, channel: native|email|sms|thumbtack|voice, externalThreadKey?, contractorContact? }
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 */
export async function GET(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobId = new URL(request.url).searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const threads = await listThreadsForJob(jobId);
    return NextResponse.json({ success: true, data: threads });
}

export async function POST(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, channel, externalThreadKey, contractorContact } = await request.json();
    if (!jobId || !channel) return NextResponse.json({ error: 'jobId and channel required' }, { status: 400 });
    if (!['native', 'email', 'sms', 'thumbtack', 'voice'].includes(channel)) {
        return NextResponse.json({ error: 'invalid channel' }, { status: 400 });
    }

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const thread = await getOrCreateThread(jobId, channel as BidChannel, externalThreadKey);
    if (!thread) return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });

    if (contractorContact) {
        await supabaseAdmin.from('bid_threads').update({ contractor_contact: contractorContact }).eq('id', thread.id);
    }
    return NextResponse.json({ success: true, data: thread });
}
