/**
 * Bid Desk Service
 *
 * Core of the Hermes Agent "agentic middleman" use case (Phase 0).
 * Wraps the `bid_desk` schema (job_briefs, bid_threads, bid_messages,
 * ranked_quotes) behind a typed service that the Hermes agent calls via
 * existing agent endpoints (/api/agent-instruct, /api/agent-respond, /api/mcp)
 * and/or directly from route handlers.
 *
 * Written with supabaseAdmin (service_role) so agent writes bypass RLS,
 * matching the existing messages/agent_* pattern. Owner reads go through RLS.
 *
 * See docs/plans/2026-08-13-hermes-agent-bid-desk.md
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchOutbound } from '@/services/channelAdapters';
import type { JobBrief, BidThread, BidMessage, RankedQuote, BidChannel } from '@/types';

// ---------------------------------------------------------------------------
// Job Briefs (single source of truth)
// ---------------------------------------------------------------------------

export async function getJobBrief(jobId: string): Promise<JobBrief | null> {
    const { data, error } = await supabaseAdmin
        .from('job_briefs')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
    if (error) {
        console.error('[bidDesk] getJobBrief error:', error.message);
        return null;
    }
    return data as JobBrief | null;
}

export async function upsertJobBrief(
    jobId: string,
    brief: Omit<JobBrief, 'id' | 'job_id' | 'created_at' | 'updated_at'>
): Promise<JobBrief | null> {
    const { data, error } = await supabaseAdmin
        .from('job_briefs')
        .upsert({ job_id: jobId, ...brief, updated_at: new Date().toISOString() }, { onConflict: 'job_id' })
        .select()
        .single();
    if (error) {
        console.error('[bidDesk] upsertJobBrief error:', error.message);
        return null;
    }
    return data as JobBrief | null;
}

// ---------------------------------------------------------------------------
// Bid Threads (one per external conversation)
// ---------------------------------------------------------------------------

export async function getOrCreateThread(jobId: string, channel: BidChannel, externalThreadKey?: string): Promise<BidThread | null> {
    if (externalThreadKey) {
        const { data: existing } = await supabaseAdmin
            .from('bid_threads')
            .select('*')
            .eq('channel', channel)
            .eq('external_thread_key', externalThreadKey)
            .maybeSingle();
        if (existing) return existing as BidThread;
    }
    const { data, error } = await supabaseAdmin
        .from('bid_threads')
        .insert({ job_id: jobId, channel, external_thread_key: externalThreadKey || null })
        .select()
        .single();
    if (error) {
        console.error('[bidDesk] getOrCreateThread error:', error.message);
        return null;
    }
    return data as BidThread;
}

export async function listThreadsForJob(jobId: string): Promise<BidThread[]> {
    const { data, error } = await supabaseAdmin
        .from('bid_threads')
        .select('*')
        .eq('job_id', jobId)
        .order('last_activity_at', { ascending: false });
    if (error) {
        console.error('[bidDesk] listThreadsForJob error:', error.message);
        return [];
    }
    return (data || []) as BidThread[];
}

// ---------------------------------------------------------------------------
// Bid Messages (normalized conversation across all channels)
// ---------------------------------------------------------------------------

export async function addBidMessage(
    threadId: string,
    input: {
        direction: 'in' | 'out';
        sender: string;
        recipient?: string;
        body: string;
        raw?: Record<string, unknown>;
        extractedQuote?: Record<string, unknown>;
        isAgentAction?: boolean;
    }
): Promise<BidMessage | null> {
    const { data, error } = await supabaseAdmin
        .from('bid_messages')
        .insert({
            thread_id: threadId,
            direction: input.direction,
            sender: input.sender,
            recipient: input.recipient || null,
            body: input.body,
            raw: input.raw || {},
            extracted_quote: input.extractedQuote || null,
            is_agent_action: input.isAgentAction || false,
        })
        .select()
        .single();
    if (error) {
        console.error('[bidDesk] addBidMessage error:', error.message);
        return null;
    }
    return data as BidMessage | null;
}

export async function listMessagesForThread(threadId: string): Promise<BidMessage[]> {
    const { data, error } = await supabaseAdmin
        .from('bid_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('[bidDesk] listMessagesForThread error:', error.message);
        return [];
    }
    return (data || []) as BidMessage[];
}

// ---------------------------------------------------------------------------
// Ranked Quotes
// ---------------------------------------------------------------------------

export async function setRankedQuote(
    threadId: string,
    quote: Omit<RankedQuote, 'id' | 'thread_id' | 'created_at'>
): Promise<RankedQuote | null> {
    const { data, error } = await supabaseAdmin
        .from('ranked_quotes')
        .upsert({ thread_id: threadId, ...quote }, { onConflict: 'thread_id' })
        .select()
        .single();
    if (error) {
        console.error('[bidDesk] setRankedQuote error:', error.message);
        return null;
    }
    return data as RankedQuote | null;
}

export async function listRankedQuotes(jobId: string): Promise<RankedQuote[]> {
    const { data, error } = await supabaseAdmin
        .from('ranked_quotes')
        .select('*, bid_threads!inner(job_id)')
        .eq('bid_threads.job_id', jobId)
        .order('rank', { ascending: true });
    if (error) {
        console.error('[bidDesk] listRankedQuotes error:', error.message);
        return [];
    }
    return (data || []) as RankedQuote[];
}

// ---------------------------------------------------------------------------
// Redistribution ("update once, reach many")
// ---------------------------------------------------------------------------

/**
 * Compose + dispatch a single message to every OPEN thread for a job through
 * the owning channel adapter. Records the outbound intent in bid_messages,
 * actually delivers it via the channel (email/SMS/native/thumbtack/voice), and
 * returns per-thread send records for the agent_actions audit log.
 */
export async function redistributeToOpenThreads(
    jobId: string,
    input: { sender: string; body: string }
): Promise<{ threadId: string; ok: boolean; channel?: string; provider?: string; error?: string; message?: BidMessage }[]> {
    const threads = await listThreadsForJob(jobId);
    const open = threads.filter(t => t.status === 'OPEN' || t.status === 'AWAITING_VENDOR');

    const results: { threadId: string; ok: boolean; channel?: string; provider?: string; error?: string; message?: BidMessage }[] = [];
    for (const thread of open) {
        const msg = await addBidMessage(thread.id, {
            direction: 'out',
            sender: input.sender,
            body: input.body,
            isAgentAction: true,
        });
        // Actually deliver through the channel adapter (email/SMS/native/voice).
        const delivery = await dispatchOutbound(thread, input.body);
        results.push({
            threadId: thread.id,
            ok: !!msg && delivery.ok,
            channel: thread.channel,
            provider: delivery.provider,
            error: delivery.error,
            message: msg || undefined,
        });
    }
    return results;
}
