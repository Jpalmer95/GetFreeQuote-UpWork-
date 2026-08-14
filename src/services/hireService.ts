/**
 * Bid Desk — Scheduling & Final Selection / Hire (Phase 6)
 *
 * From the ranked report to a scheduled hire:
 *   1. capture concrete start windows per top candidate,
 *   2. owner approves a selection,
 *   3. generate a one-page short work order (scope from the Job Brief + price +
 *      dates + sequence liability + pay-after-completion),
 *   4. deliver it to the chosen contractor via their channel,
 *   5. close out all other threads with a courtesy notice.
 *
 * PURE-LOGIC work-order text (the "generateWorkOrder" function) is unit-testable;
 * the DB/channel operations go through bidDesk + channelAdapters.
 *
 * See docs/plans/2026-08-13-hermes-agent-bid-desk.md (Phase 6).
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getJobBrief, getOrCreateThread, addBidMessage } from '@/services/bidDesk';
import { dispatchOutbound } from '@/services/channelAdapters';
import type { JobBrief } from '@/types';

// ---------------------------------------------------------------------------
// Work order (pure logic)
// ---------------------------------------------------------------------------
export interface WorkOrderInput {
    vendorName: string;
    scope: string;
    price: number;
    startDate?: string | null;
    durationDays?: number | null;
    exclusions?: string | null;
    licenseRequired?: boolean;
}

/** One-page short work order, reusable for any trade. */
export function generateWorkOrder(input: WorkOrderInput): string {
    const lines = [
        'SHORT WORK ORDER',
        '================',
        '',
        `Contractor: ${input.vendorName}`,
        `Scope of work: ${input.scope}`,
        `Price (all-inclusive, unless excluded): $${input.price.toLocaleString()}`,
    ];
    if (input.startDate) lines.push(`Anticipated start: ${input.startDate}`);
    if (input.durationDays) lines.push(`Anticipated duration: ${input.durationDays} day(s)`);
    if (input.exclusions) lines.push(`Exclusions: ${input.exclusions}`);
    if (input.licenseRequired) lines.push('Licensed + insured (COI on file) required.');
    lines.push(
        '',
        'Payment: payable upon completion of the scoped work as verified by the owner.',
        'Sequence liability: the contractor is responsible for rework caused by their own sequencing.',
        'Scope changes must be agreed in writing before work proceeds.',
        '',
        'Accept by replying to this message confirming price, scope, and dates.',
    );
    return lines.join('\n');
}

/** Suggest concrete start windows from an availability note. */
export function proposeSiteVisitWindows(availability: string | null | undefined, startDate?: string | null): string[] {
    const base = startDate || availability || 'within 2 weeks';
    const guess = base.match(/\d{4}-\d{2}-\d{2}/) ? new Date(base) : new Date(Date.now() + 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const next = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
    return [fmt(next(guess, 0)), fmt(next(guess, 1)), fmt(next(guess, 2))];
}

// ---------------------------------------------------------------------------
// Award / close-out (DB + channel operations)
// ---------------------------------------------------------------------------
export async function awardJobToThread(params: {
    jobId: string;
    threadId: string;
    brief?: JobBrief | null;
    ownerName?: string;
    price?: number;
    durationDays?: number | null;
    exclusions?: string | null;
}): Promise<{ ok: boolean; workOrder?: string; error?: string }> {
    const { jobId, threadId } = params;
    const brief = params.brief || (await getJobBrief(jobId));

    const { data: thread } = await supabaseAdmin.from('bid_threads').select('*').eq('id', threadId).single();
    if (!thread) return { ok: false, error: 'thread not found' };

    const contact = (thread.contractor_contact || {}) as { name?: string };
    const scopeText = brief?.scope_structured?.scope || 'per the agreed scope';

    // Resolve price: explicit param > ranked_quote for the thread > 0.
    let price = params.price ?? 0;
    if (!price) {
        const { data: rq } = await supabaseAdmin
            .from('ranked_quotes').select('quote_amount, estimated_days').eq('thread_id', threadId).maybeSingle();
        if (rq) {
            price = rq.quote_amount;
            if (!params.durationDays) params.durationDays = rq.estimated_days;
        }
    }

    const workOrder = generateWorkOrder({
        vendorName: contact.name || 'selected contractor',
        scope: typeof scopeText === 'string' ? scopeText : JSON.stringify(brief?.scope_structured || {}),
        price,
        startDate: brief?.timeline_start,
        durationDays: params.durationDays ?? null,
        exclusions: params.exclusions ?? null,
        licenseRequired: true,
    });

    // Mark this thread awarded, close the rest.
    await supabaseAdmin.from('bid_threads').update({ status: 'AWARDED' }).eq('id', threadId);
    await supabaseAdmin.from('bid_threads').update({ status: 'CLOSED' }).eq('job_id', jobId).neq('id', threadId);
    await supabaseAdmin.from('jobs').update({ status: 'IN_PROGRESS' }).eq('id', jobId);

    // Deliver the work order to the winner + courtesy close to others.
    await addBidMessage(threadId, { direction: 'out', sender: 'owner-agent', body: workOrder, isAgentAction: true });
    const delivery = await dispatchOutbound(thread as never, workOrder);

    const { data: others } = await supabaseAdmin
        .from('bid_threads').select('*').eq('job_id', jobId).neq('id', threadId);
    for (const t of (others || [])) {
        await addBidMessage(t.id, { direction: 'out', sender: 'owner-agent', body: 'Thank you for your quote. This job has been awarded to another contractor. Best regards.', isAgentAction: true });
        await dispatchOutbound(t as never, 'Thank you for your quote. This job has been awarded to another contractor. Best regards.');
    }

    return { ok: true, workOrder };
}
