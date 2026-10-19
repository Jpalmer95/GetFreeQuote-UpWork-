import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeEscrowManifestHash } from '@/services/verifiableEscrow';
import { generateWorkOrder } from '@/services/hireService';
import { getOrCreateThread, addBidMessage } from '@/services/bidDesk';
import { dispatchNotification } from '@/services/notificationDispatcher';
import { emitOracleEvent } from '@/services/oracle';

export interface AwardResult {
    ok: boolean;
    error?: string;
    status?: number;
    quote?: Record<string, unknown>;
    escrowId?: string | null;
    manifestHash?: string | null;
    workOrder?: string;
}

/**
 * Owner awards a pending quote: accept winner, reject others, IN_PROGRESS,
 * work order, Pattern 2 escrow (pending until payer records a tx hash).
 */
export async function awardQuoteToVendor(params: {
    quoteId: string;
    ownerId: string;
}): Promise<AwardResult> {
    const { quoteId, ownerId } = params;

    const { data: quote, error: quoteErr } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();
    if (quoteErr || !quote) return { ok: false, error: 'Quote not found', status: 404 };
    if (quote.status !== 'PENDING') {
        return { ok: false, error: `Quote is ${quote.status} and cannot be accepted`, status: 400 };
    }

    let jobTitle = 'Unknown';
    let jobUserId: string | undefined;
    let jobDescription = '';
    const jobId = quote.job_id as string | null;

    if (jobId) {
        const { data: job } = await supabaseAdmin
            .from('jobs')
            .select('id, title, user_id, description, status')
            .eq('id', jobId)
            .maybeSingle();
        if (!job) return { ok: false, error: 'Job not found', status: 404 };
        if (job.user_id !== ownerId) return { ok: false, error: 'Only the job owner can accept quotes', status: 403 };
        if (job.status !== 'OPEN' && job.status !== 'IN_PROGRESS') {
            return { ok: false, error: `Job is ${job.status} and cannot accept quotes`, status: 400 };
        }
        jobTitle = job.title || 'Unknown';
        jobUserId = job.user_id;
        jobDescription = job.description || '';
    } else if (quote.phase_id) {
        const { data: phaseData } = await supabaseAdmin
            .from('project_phases')
            .select('id, project_id, projects!inner(user_id)')
            .eq('id', quote.phase_id)
            .maybeSingle();
        const proj = phaseData ? (phaseData as Record<string, unknown>).projects as { user_id: string } : null;
        if (!proj || proj.user_id !== ownerId) {
            return { ok: false, error: 'Only the project owner can accept quotes', status: 403 };
        }
        jobUserId = proj.user_id;
    } else {
        return { ok: false, error: 'Quote is not attached to a job', status: 400 };
    }

    const now = new Date().toISOString();
    const { data: accepted, error: updErr } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'ACCEPTED', accepted_at: now })
        .eq('id', quoteId)
        .select('*')
        .single();
    if (updErr || !accepted) return { ok: false, error: 'Failed to accept quote', status: 500 };

    if (jobId) {
        await supabaseAdmin.from('quotes')
            .update({ status: 'REJECTED' })
            .eq('job_id', jobId)
            .neq('id', quoteId)
            .eq('status', 'PENDING');
        await supabaseAdmin.from('jobs').update({ status: 'IN_PROGRESS' }).eq('id', jobId);
    }

    if (quote.phase_id) {
        await supabaseAdmin.from('project_phases').update({
            status: 'QUOTED',
            accepted_quote_id: quoteId,
            actual_cost: quote.amount,
        }).eq('id', quote.phase_id);
        await supabaseAdmin.from('quotes')
            .update({ status: 'REJECTED' })
            .eq('phase_id', quote.phase_id)
            .neq('id', quoteId)
            .eq('status', 'PENDING');
    }

    const totalAmount = Number(quote.amount);
    const milestones = [
        { name: 'Milestone 1: Mobilization & Materials (30%)', amount: Math.round(totalAmount * 0.3) },
        { name: 'Milestone 2: Core Work & Rough-In (45%)', amount: Math.round(totalAmount * 0.45) },
        { name: 'Milestone 3: Final Walkthrough & Completion (25%)', amount: 0 },
    ];
    milestones[2].amount = totalAmount - milestones[0].amount - milestones[1].amount;

    const manifestHash = computeEscrowManifestHash({
        jobId,
        communityProjectId: null,
        quoteId,
        payerId: ownerId,
        payeeId: quote.vendor_id,
        chainId: 8453,
        tokenSymbol: 'USDC',
        totalAmount,
        milestones,
    });

    const { data: escrow } = await supabaseAdmin
        .from('escrow_accounts')
        .insert({
            job_id: jobId,
            quote_id: quoteId,
            payer_id: ownerId,
            payee_id: quote.vendor_id,
            chain_id: 8453,
            token_symbol: 'USDC',
            contract_address: `0x8453${manifestHash.slice(0, 36)}`,
            manifest_hash: manifestHash,
            total_amount: totalAmount,
            funded_amount: 0,
            released_amount: 0,
            status: 'pending',
        })
        .select()
        .maybeSingle();

    if (escrow) {
        for (let i = 0; i < milestones.length; i++) {
            await supabaseAdmin.from('escrow_milestones').insert({
                escrow_account_id: escrow.id,
                name: milestones[i].name,
                amount: milestones[i].amount,
                status: 'pending',
                sort_order: i + 1,
            });
        }
    }

    const workOrder = generateWorkOrder({
        vendorName: quote.vendor_name || 'selected contractor',
        scope: jobDescription || jobTitle,
        price: totalAmount,
        durationDays: quote.estimated_days ?? null,
        licenseRequired: true,
    });

    if (jobId) {
        await supabaseAdmin.from('messages').insert({
            job_id: jobId,
            sender_id: 'system-agent',
            sender_type: 'system',
            content: `Quote of $${totalAmount} from ${quote.vendor_name} accepted. Job is in progress.\n\n${workOrder}`,
            is_agent_action: true,
        });

        const thread = await getOrCreateThread(jobId, 'native', `native:${quote.vendor_id}`);
        if (thread) {
            await supabaseAdmin.from('bid_threads').update({
                status: 'AWARDED',
                contractor_contact: { name: quote.vendor_name, userId: quote.vendor_id },
            }).eq('id', thread.id);
            await supabaseAdmin.from('bid_threads').update({ status: 'CLOSED' }).eq('job_id', jobId).neq('id', thread.id);
            await addBidMessage(thread.id, { direction: 'out', sender: 'owner-agent', body: workOrder, isAgentAction: true });
        }
    }

    await dispatchNotification({
        userId: quote.vendor_id,
        jobId: jobId || null,
        type: 'milestone',
        priority: 'high',
        title: 'Quote Accepted!',
        message: `Your quote of $${totalAmount} for "${jobTitle}" was accepted. Record the payment against escrow ${escrow?.id || ''} when funded.`,
        actionRequired: false,
        actionUrl: '/vendor',
    });

    if (jobId && jobUserId) {
        await supabaseAdmin.from('agent_actions').insert({
            job_id: jobId,
            user_id: jobUserId,
            action_type: 'negotiation',
            summary: `Accepted quote of $${totalAmount} from ${quote.vendor_name}`,
            details: { quoteId, amount: totalAmount, vendorName: quote.vendor_name, escrowId: escrow?.id, manifestHash },
            automated: false,
        });
        await emitOracleEvent({
            eventType: 'quote.accepted',
            entityType: 'quote',
            entityId: quoteId,
            payload: { jobId, amount: totalAmount, vendorId: quote.vendor_id, escrowId: escrow?.id, manifestHash },
        });
    }

    return {
        ok: true,
        quote: accepted as Record<string, unknown>,
        escrowId: escrow?.id || null,
        manifestHash,
        workOrder,
    };
}

export async function completeAwardedJob(params: {
    jobId: string;
    ownerId: string;
}): Promise<{ ok: boolean; error?: string; status?: number }> {
    const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('id, user_id, status, title')
        .eq('id', params.jobId)
        .maybeSingle();
    if (!job) return { ok: false, error: 'Job not found', status: 404 };
    if (job.user_id !== params.ownerId) return { ok: false, error: 'Only the job owner can mark it complete', status: 403 };
    if (job.status !== 'IN_PROGRESS') {
        return { ok: false, error: `Job is ${job.status}; only in-progress jobs can be completed`, status: 400 };
    }

    await supabaseAdmin.from('jobs').update({ status: 'COMPLETED' }).eq('id', params.jobId);
    await supabaseAdmin.from('messages').insert({
        job_id: params.jobId,
        sender_id: 'system-agent',
        sender_type: 'system',
        content: `Job "${job.title}" marked complete by the owner.`,
        is_agent_action: true,
    });
    await supabaseAdmin.from('agent_actions').insert({
        job_id: params.jobId,
        user_id: params.ownerId,
        action_type: 'negotiation',
        summary: `Marked job complete: ${job.title}`,
        details: { jobId: params.jobId },
        automated: false,
    });
    await emitOracleEvent({
        eventType: 'job.completed',
        entityType: 'job',
        entityId: params.jobId,
        payload: { title: job.title },
    });
    return { ok: true };
}
