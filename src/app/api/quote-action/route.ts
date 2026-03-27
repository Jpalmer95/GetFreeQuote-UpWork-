import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { sendNotificationEmail } from '@/services/serverEmail';

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
            .select('*')
            .eq('id', quoteId)
            .single();

        if (checkError || !quoteCheck) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }

        let authorized = false;
        let jobTitle = 'Unknown';
        let jobUserId: string | undefined;

        if (quoteCheck.job_id) {
            const { data: jobData } = await supabaseAdmin
                .from('jobs')
                .select('id, title, user_id')
                .eq('id', quoteCheck.job_id)
                .single();
            if (jobData) {
                authorized = jobData.user_id === caller.id;
                jobTitle = jobData.title || 'Unknown';
                jobUserId = jobData.user_id;
            }
        }

        if (!authorized && quoteCheck.phase_id) {
            const { data: phaseData } = await supabaseAdmin
                .from('project_phases')
                .select('id, project_id, projects!inner(user_id)')
                .eq('id', quoteCheck.phase_id)
                .single();
            if (phaseData && (phaseData as Record<string, unknown>).projects) {
                const proj = (phaseData as Record<string, unknown>).projects as { user_id: string };
                authorized = proj.user_id === caller.id;
                jobUserId = proj.user_id;
            }
        }

        if (!authorized) {
            return NextResponse.json({ error: 'Forbidden: only owner can accept/reject quotes' }, { status: 403 });
        }

        const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

        const { data: quote, error: quoteError } = await supabaseAdmin
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', quoteId)
            .select('*')
            .single();

        if (quoteError) {
            return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
        }

        const jobId = quote.job_id;
        const vendorId = quote.vendor_id;
        const phaseId = quote.phase_id;

        if (action === 'accept') {
            if (jobId) {
                await supabaseAdmin.from('jobs').update({ status: 'IN_PROGRESS' }).eq('id', jobId);
            }

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

            if (jobId) {
                await supabaseAdmin.from('messages').insert({
                    job_id: jobId,
                    sender_id: 'system-agent',
                    sender_type: 'system',
                    content: `Quote of $${quote.amount} from ${quote.vendor_name} has been accepted. Project is now in progress.`,
                    is_agent_action: true,
                });
            }

            await supabaseAdmin.from('notifications').insert({
                user_id: vendorId,
                job_id: jobId,
                type: 'milestone',
                priority: 'high',
                title: 'Quote Accepted!',
                message: `Your quote of $${quote.amount} from ${quote.vendor_name} has been accepted.`,
                action_required: false,
                read: false,
            });

            sendNotificationEmail(vendorId, 'milestone', 'Quote Accepted!',
                `Your quote of $${quote.amount} for "${jobTitle}" has been accepted.`, '/vendor').catch(() => {});

            if (jobId && jobUserId) {
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

            if (jobId) {
                await supabaseAdmin.from('messages').insert({
                    job_id: jobId,
                    sender_id: 'system-agent',
                    sender_type: 'system',
                    content: `Quote of $${quote.amount} from ${quote.vendor_name} has been declined.`,
                    is_agent_action: true,
                });
            }

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

            sendNotificationEmail(vendorId, 'negotiation_update', 'Quote Declined',
                `Your quote of $${quote.amount} for "${jobTitle}" was not accepted.`, '/vendor').catch(() => {});

            if (jobId && jobUserId) {
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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Quote action error:', message);
        const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('SUPABASE_URL') ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
