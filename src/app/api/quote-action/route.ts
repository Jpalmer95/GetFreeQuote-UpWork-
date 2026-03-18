import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
    try {
        const caller = await getAuthenticatedUser(request);
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { quoteId, action } = await request.json();

        if (!quoteId || !['accept', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'quoteId and action (accept/reject) required' }, { status: 400 });
        }

        const { data: quoteCheck, error: checkError } = await supabaseAdmin
            .from('quotes')
            .select('*, jobs!inner(id, title, user_id)')
            .eq('id', quoteId)
            .single();

        if (checkError || !quoteCheck) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }

        if (quoteCheck.jobs?.user_id !== caller.id) {
            return NextResponse.json({ error: 'Forbidden: only job owner can accept/reject quotes' }, { status: 403 });
        }

        const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

        const { data: quote, error: quoteError } = await supabaseAdmin
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', quoteId)
            .select('*, jobs!inner(id, title, user_id)')
            .single();

        if (quoteError) {
            return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
        }

        const jobId = quote.job_id;
        const jobTitle = quote.jobs?.title || 'Unknown';
        const jobUserId = quote.jobs?.user_id;
        const vendorId = quote.vendor_id;
        const phaseId = quote.phase_id;

        if (action === 'accept') {
            await supabaseAdmin.from('jobs').update({ status: 'IN_PROGRESS' }).eq('id', jobId);

            if (phaseId) {
                await supabaseAdmin.from('project_phases').update({
                    status: 'QUOTED',
                    accepted_quote_id: quoteId,
                    actual_cost: quote.amount,
                }).eq('id', phaseId);

                await supabaseAdmin.from('quotes')
                    .update({ status: 'REJECTED' })
                    .eq('phase_id', phaseId)
                    .neq('id', quoteId)
                    .eq('status', 'PENDING');
            }

            await supabaseAdmin.from('messages').insert({
                job_id: jobId,
                sender_id: 'system-agent',
                sender_type: 'system',
                content: `Quote of $${quote.amount} from ${quote.vendor_name} has been accepted. Project is now in progress.`,
                is_agent_action: true,
            });

            await supabaseAdmin.from('notifications').insert({
                user_id: vendorId,
                job_id: jobId,
                type: 'milestone',
                priority: 'high',
                title: 'Quote Accepted!',
                message: `Your quote of $${quote.amount} for "${jobTitle}" has been accepted.`,
                action_required: false,
                read: false,
            });

            if (jobUserId) {
                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: jobUserId,
                    action_type: 'negotiation',
                    summary: `Accepted quote of $${quote.amount} from ${quote.vendor_name}`,
                    details: { quoteId, amount: quote.amount, vendorName: quote.vendor_name },
                    automated: false,
                });
            }
        } else {
            if (phaseId) {
                const { data: remainingPending } = await supabaseAdmin
                    .from('quotes')
                    .select('id')
                    .eq('phase_id', phaseId)
                    .eq('status', 'PENDING');

                if (!remainingPending || remainingPending.length === 0) {
                    await supabaseAdmin.from('project_phases').update({
                        status: 'WAITING_QUOTES',
                        accepted_quote_id: null,
                        actual_cost: null,
                    }).eq('id', phaseId);
                }
            }

            await supabaseAdmin.from('messages').insert({
                job_id: jobId,
                sender_id: 'system-agent',
                sender_type: 'system',
                content: `Quote of $${quote.amount} from ${quote.vendor_name} has been declined.`,
                is_agent_action: true,
            });

            await supabaseAdmin.from('notifications').insert({
                user_id: vendorId,
                job_id: jobId,
                type: 'negotiation_update',
                priority: 'medium',
                title: 'Quote Declined',
                message: `Your quote of $${quote.amount} for "${jobTitle}" was not accepted.`,
                action_required: false,
                read: false,
            });

            if (jobUserId) {
                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: jobUserId,
                    action_type: 'negotiation',
                    summary: `Rejected quote of $${quote.amount} from ${quote.vendor_name}`,
                    details: { quoteId, amount: quote.amount, vendorName: quote.vendor_name },
                    automated: false,
                });
            }
        }

        return NextResponse.json({ status: 'ok', newStatus });
    } catch (error) {
        console.error('Quote action error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
