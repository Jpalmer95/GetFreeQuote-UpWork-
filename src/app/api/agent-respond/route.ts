import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

function customerAgentId(userId: string): string {
    return `customer-agent-${userId}`;
}

function vendorAgentId(userId: string): string {
    return `vendor-agent-${userId}`;
}

function mapAgentConfig(row: any) {
    return {
        id: row.id,
        userId: row.user_id,
        role: row.role,
        isActive: row.is_active,
        autoRespond: row.auto_respond,
        autoQuote: row.auto_quote,
        maxBudget: row.max_budget,
        minBudget: row.min_budget,
        industries: row.industries || [],
        specialties: row.specialties || [],
        maxDistance: row.max_distance,
        baseRate: row.base_rate,
        communicationStyle: row.communication_style || 'professional',
        escalationTriggers: row.escalation_triggers || [],
        autoApproveBelow: row.auto_approve_below,
        workingHoursOnly: row.working_hours_only,
    };
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getAuthenticatedUser(request);
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId, message } = await request.json();
        if (!jobId || !message) {
            return NextResponse.json({ error: 'jobId and message required' }, { status: 400 });
        }

        const { data: jobRow } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (!jobRow) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const isJobOwner = jobRow.user_id === caller.id;

        const { data: vendorQuote } = await supabaseAdmin
            .from('quotes')
            .select('*')
            .eq('job_id', jobId)
            .eq('vendor_id', caller.id)
            .maybeSingle();

        const isVendorParticipant = !!vendorQuote;

        if (!isJobOwner && !isVendorParticipant) {
            return NextResponse.json({ error: 'Forbidden: not a participant in this job' }, { status: 403 });
        }

        const senderType = isJobOwner ? 'user' : 'vendor';
        await supabaseAdmin.from('messages').insert({
            job_id: jobId,
            sender_id: caller.id,
            sender_type: senderType,
            content: message,
            is_agent_action: false,
        });

        const { data: configRow } = await supabaseAdmin
            .from('agent_configs')
            .select('*')
            .eq('user_id', caller.id)
            .maybeSingle();

        const callerConfig = configRow ? mapAgentConfig(configRow) : null;
        const responses: string[] = [];

        if (isJobOwner && callerConfig?.isActive && callerConfig.autoRespond) {
            const lowerMsg = message.toLowerCase();

            const hasNewDetails = lowerMsg.includes('dimension') || lowerMsg.includes('size') ||
                lowerMsg.includes('material') || lowerMsg.includes('budget') ||
                lowerMsg.includes('photo') || lowerMsg.includes('update') ||
                lowerMsg.includes('change') || lowerMsg.includes('addition') ||
                message.length > 100;

            if (hasNewDetails) {
                const style = callerConfig.communicationStyle;
                const agentMsg = style === 'friendly'
                    ? `Thanks for the additional details! I'll update the vendors about these changes and request revised quotes.`
                    : style === 'concise'
                    ? `Details received. Notifying vendors for revised estimates.`
                    : `Thank you for providing additional details. I'll notify all participating vendors and request updated quotes based on the new specifications.`;

                await supabaseAdmin.from('messages').insert({
                    job_id: jobId,
                    sender_id: customerAgentId(caller.id),
                    sender_type: 'customer_agent',
                    content: agentMsg,
                    is_agent_action: true,
                });
                responses.push('customer_agent_acknowledged');

                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: caller.id,
                    action_type: 'scope_analysis',
                    summary: 'Customer provided additional details; notifying vendors for revised quotes',
                    details: { messageLength: message.length, triggerType: 'user_update' },
                    automated: true,
                    agent_config_id: callerConfig.id,
                });

                const { data: vendorQuotes } = await supabaseAdmin
                    .from('quotes')
                    .select('vendor_id')
                    .eq('job_id', jobId);

                for (const vq of (vendorQuotes || [])) {
                    const { data: vcRow } = await supabaseAdmin
                        .from('agent_configs')
                        .select('*')
                        .eq('user_id', vq.vendor_id)
                        .eq('is_active', true)
                        .maybeSingle();

                    if (vcRow) {
                        const vc = mapAgentConfig(vcRow);
                        if (vc.autoRespond) {
                            const vendorResponse = vc.communicationStyle === 'friendly'
                                ? `Got it! We'll review the new details and update our estimate shortly.`
                                : vc.communicationStyle === 'concise'
                                ? `Acknowledged. Revising estimate with updated scope.`
                                : `We've received the updated project specifications. Our team will review and provide a revised estimate.`;

                            await supabaseAdmin.from('messages').insert({
                                job_id: jobId,
                                sender_id: vendorAgentId(vq.vendor_id),
                                sender_type: 'vendor_agent',
                                content: vendorResponse,
                                is_agent_action: true,
                            });

                            await supabaseAdmin.from('notifications').insert({
                                user_id: vq.vendor_id,
                                job_id: jobId,
                                type: 'scope_change',
                                priority: 'medium',
                                title: 'Scope Update',
                                message: `The customer updated project details for "${jobRow.title}". Review and revise your quote.`,
                                action_required: true,
                                read: false,
                            });
                        }
                    }
                }
            }

            const escalationKeywords = ['urgent', 'escalate', 'manager', 'issue', 'problem', 'complaint', 'refund'];
            if (escalationKeywords.some(kw => lowerMsg.includes(kw)) && callerConfig.escalationTriggers.includes('scope_change')) {
                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: caller.id,
                    action_type: 'escalation',
                    summary: 'Message flagged for human review based on escalation triggers',
                    details: { message: message.substring(0, 200) },
                    automated: true,
                    agent_config_id: callerConfig.id,
                });

                await supabaseAdmin.from('notifications').insert({
                    user_id: caller.id,
                    job_id: jobId,
                    type: 'approval_needed',
                    priority: 'high',
                    title: 'Action Required',
                    message: `Your message about "${jobRow.title}" has been flagged. Your agent recommends direct attention.`,
                    action_required: true,
                    read: false,
                });
                responses.push('escalation_flagged');
            }
        }

        if (isVendorParticipant) {
            const { data: vcRow } = await supabaseAdmin
                .from('agent_configs')
                .select('*')
                .eq('user_id', caller.id)
                .eq('is_active', true)
                .maybeSingle();

            if (vcRow) {
                const vc = mapAgentConfig(vcRow);
                if (vc.autoRespond) {
                    await supabaseAdmin.from('agent_actions').insert({
                        job_id: jobId,
                        user_id: caller.id,
                        action_type: 'clarification_received',
                        summary: 'Vendor sent a message in the project thread',
                        details: { messagePreview: message.substring(0, 200) },
                        automated: true,
                        agent_config_id: vc.id,
                    });
                }
            }

            const { data: ownerConfig } = await supabaseAdmin
                .from('agent_configs')
                .select('*')
                .eq('user_id', jobRow.user_id)
                .eq('is_active', true)
                .maybeSingle();

            if (ownerConfig && mapAgentConfig(ownerConfig).autoRespond) {
                await supabaseAdmin.from('notifications').insert({
                    user_id: jobRow.user_id,
                    job_id: jobId,
                    type: 'negotiation_update',
                    priority: 'medium',
                    title: 'Vendor Message',
                    message: `A vendor sent a message regarding "${jobRow.title}".`,
                    action_required: false,
                    read: false,
                });
                responses.push('owner_notified');
            }
        }

        return NextResponse.json({ status: 'ok', responses });
    } catch (error) {
        console.error('Agent respond error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
