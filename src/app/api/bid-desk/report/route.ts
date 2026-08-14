import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBidDeskCaller } from '@/lib/bidDeskAuth';
import { rankQuotes, buildQuotesCsv, summarizeTop, RankedRow } from '@/services/quoteRanker';
import type { RankedQuote, BidThread } from '@/types';

/**
 * GET /api/bid-desk/report?jobId=...&format=csv|json|summary
 *
 * Builds the apples-to-apples quote comparison for a job from its ranked_quotes
 * rows, plus per-thread channel/vendor context. Returns ranked JSON, a CSV, or
 * the top-N summary — whatever the owner's Hermes agent or dashboard needs.
 *
 * Auth: job owner (session) or Hermes agent (Bearer bfk_...).
 */
export async function GET(request: NextRequest) {
    const caller = await getBidDeskCaller(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const format = searchParams.get('format') || 'json';
    if (!jobId) return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== caller.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Pull ranked quotes joined with their threads for vendor/channel context.
    const { data: threadRows } = await supabaseAdmin
        .from('bid_threads')
        .select('id, channel, contractor_contact')
        .eq('job_id', jobId);
    const threads = (threadRows || []) as BidThread[];
    const threadById = new Map(threads.map(t => [t.id, t]));

    const { data: quoteRows } = await supabaseAdmin
        .from('ranked_quotes')
        .select('*')
        .in('thread_id', threads.map(t => t.id).length ? threads.map(t => t.id) : ['__none__']);

    const quotes = (quoteRows || []) as RankedQuote[];
    const ranked = rankQuotes(quotes);

    // Attach vendor + channel context to each row.
    const enriched: RankedRow[] = ranked.map(r => {
        const t = threadById.get(r.threadId);
        const contact = (t?.contractor_contact || {}) as { name?: string };
        return {
            ...r,
            vendor: contact.name || null,
            channel: t?.channel || null,
        };
    });

    if (format === 'csv') {
        const csv = buildQuotesCsv(enriched);
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="quotes_report_${jobId}.csv"`,
            },
        });
    }

    if (format === 'summary') {
        return NextResponse.json({ success: true, data: summarizeTop(enriched, 3) });
    }

    return NextResponse.json({ success: true, data: enriched });
}
