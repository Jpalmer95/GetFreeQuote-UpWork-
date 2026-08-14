import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { listMessagesForThread, addBidMessage } from '@/services/bidDesk';

/**
 * GET  /api/bid-desk/messages?threadId=...  → conversation in a thread
 * POST /api/bid-desk/messages               → add a message to a thread
 *   Body: { threadId, direction: in|out, sender, recipient?, body, extractedQuote?, isAgentAction? }
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 * This is how the Hermes agent reads inbound contractor messages and posts
 * replies; the owner can read the same normalized thread from the UI.
 */
export async function GET(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const threadId = new URL(request.url).searchParams.get('threadId');
    if (!threadId) return NextResponse.json({ error: 'threadId query param required' }, { status: 400 });

    const { data: thread } = await supabaseAdmin.from('bid_threads').select('id, job_id').eq('id', threadId).single();
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', thread.job_id).single();
    if (!job || job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const messages = await listMessagesForThread(threadId);
    return NextResponse.json({ success: true, data: messages });
}

export async function POST(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { threadId, direction, sender, recipient, body, extractedQuote, isAgentAction } = await request.json();
    if (!threadId || !direction || !sender || !body) {
        return NextResponse.json({ error: 'threadId, direction, sender, body required' }, { status: 400 });
    }
    if (!['in', 'out'].includes(direction)) return NextResponse.json({ error: 'invalid direction' }, { status: 400 });

    const { data: thread } = await supabaseAdmin.from('bid_threads').select('id, job_id').eq('id', threadId).single();
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', thread.job_id).single();
    if (!job || job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const message = await addBidMessage(threadId, {
        direction,
        sender,
        recipient,
        body,
        extractedQuote,
        isAgentAction: isAgentAction || false,
    });
    if (!message) return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    return NextResponse.json({ success: true, data: message });
}
