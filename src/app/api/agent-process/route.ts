import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { Job, AgentConfig, EstimatingTemplate, EstimatingLineItem } from '@/types';
import {
    JobRow, AgentConfigRow, VendorProfileRow, EstimatingTemplateRow,
    mapJobRow, mapAgentConfigRow, mapVendorProfileRow, mapEstimatingTemplateRow,
    customerAgentId, vendorAgentId, SYSTEM_AGENT_ID,
    estimateHours,
} from '@/services/serverMappers';

async function addMessage(jobId: string, senderId: string, senderType: string, content: string): Promise<void> {
    await supabaseAdmin.from('messages').insert({
        job_id: jobId,
        sender_id: senderId,
        sender_type: senderType,
        content,
        is_agent_action: true,
    });
}

function calculateFromTemplate(template: EstimatingTemplate, job: Job, hours: number): { amount: number; breakdown: string[] } {
    const breakdown: string[] = [];
    let total = 0;
    const sqft = job.squareFootage ? parseFloat(String(job.squareFootage).replace(/[^0-9.]/g, '')) : 0;

    for (const item of template.lineItems) {
        let itemTotal = 0;
        switch (item.pricingModel) {
            case 'hourly':
                itemTotal = (item.rate || template.laborRate) * hours;
                breakdown.push(`${item.name}: ${hours}hrs x $${item.rate || template.laborRate}/hr = $${Math.round(itemTotal)}`);
                break;
            case 'per_unit': {
                const units = sqft > 0 ? sqft : hours;
                itemTotal = item.rate * units;
                breakdown.push(`${item.name}: ${units} ${item.unit || 'units'} x $${item.rate} = $${Math.round(itemTotal)}`);
                break;
            }
            case 'flat_fee':
                itemTotal = item.rate;
                breakdown.push(`${item.name}: $${item.rate} (flat)`);
                break;
            case 'tiered': {
                const qty = sqft > 0 ? sqft : hours;
                const tier = (item.tiers || []).find(t => qty >= t.minQty && qty <= t.maxQty);
                itemTotal = tier ? tier.rate * qty : item.rate * qty;
                breakdown.push(`${item.name}: ${qty} units @ tier rate = $${Math.round(itemTotal)}`);
                break;
            }
            default:
                itemTotal = item.rate * hours;
                breakdown.push(`${item.name}: $${Math.round(itemTotal)}`);
        }

        const markup = item.materialMarkupPercent ?? template.materialMarkupPercent;
        if (markup > 0 && item.pricingModel !== 'flat_fee') {
            const markupAmt = itemTotal * (markup / 100);
            itemTotal += markupAmt;
            breakdown.push(`  + ${markup}% material markup: $${Math.round(markupAmt)}`);
        }

        if (item.minimumCharge && itemTotal < item.minimumCharge) {
            itemTotal = item.minimumCharge;
            breakdown.push(`  (minimum charge applied: $${item.minimumCharge})`);
        }

        total += itemTotal;
    }

    if (total < template.minimumCharge) {
        total = template.minimumCharge;
        breakdown.push(`Minimum charge applied: $${template.minimumCharge}`);
    }

    return { amount: Math.round(total), breakdown };
}

async function findBestTemplate(vendorUserId: string, job: Job): Promise<EstimatingTemplate | null> {
    const { data: profileData } = await supabaseAdmin
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', vendorUserId)
        .maybeSingle();

    if (!profileData) return null;

    const { data: templateData } = await supabaseAdmin
        .from('estimating_templates')
        .select('*')
        .eq('vendor_profile_id', profileData.id);

    if (!templateData || templateData.length === 0) return null;

    const templates = templateData.map((r) => mapEstimatingTemplateRow(r as EstimatingTemplateRow));

    const exactMatch = templates.find(t =>
        t.industryVertical === job.industryVertical && t.serviceCategory === job.subcategory
    );
    if (exactMatch) return exactMatch;

    const industryMatch = templates.find(t => t.industryVertical === job.industryVertical && t.isDefault);
    if (industryMatch) return industryMatch;

    const defaultTemplate = templates.find(t => t.isDefault);
    if (defaultTemplate) return defaultTemplate;

    return templates[0];
}

async function logAction(jobId: string, userId: string, actionType: string, summary: string, details: Record<string, unknown> = {}, agentConfigId?: string): Promise<void> {
    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        agent_config_id: agentConfigId,
        user_id: userId,
        action_type: actionType,
        summary,
        details,
        automated: true,
    });
}

async function createNotification(userId: string, jobId: string | null, type: string, priority: string, title: string, message: string, actionRequired: boolean, actionUrl?: string): Promise<void> {
    await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        job_id: jobId,
        type,
        priority,
        title,
        message,
        action_required: actionRequired,
        action_url: actionUrl,
        read: false,
    });
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getAuthenticatedUser(request);
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId } = await request.json();
        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }

        const { data: jobRow, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobError || !jobRow) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const job = mapJobRow(jobRow as JobRow);

        if (job.userId !== caller.id) {
            return NextResponse.json({ error: 'Forbidden: not job owner' }, { status: 403 });
        }

        const { data: customerConfigRow } = await supabaseAdmin
            .from('agent_configs')
            .select('*')
            .eq('user_id', job.userId)
            .maybeSingle();

        const customerConfig = customerConfigRow ? mapAgentConfigRow(customerConfigRow as AgentConfigRow) : null;
        const style = customerConfig?.communicationStyle || 'professional';

        await addMessage(job.id, customerAgentId(job.userId), 'customer_agent',
            `Project "${job.title}" received. Analyzing requirements and searching for matching vendors...`);

        await logAction(job.id, job.userId, 'scope_analysis',
            `Analyzed project scope: ${job.industryVertical} / ${job.subcategory}`,
            { industry: job.industryVertical, subcategory: job.subcategory, budget: job.budget, urgency: job.urgency },
            customerConfig?.id);

        if ((job.description || '').length < 30) {
            const clarMessages: Record<string, string> = {
                professional: `I've reviewed your project "${job.title}" and noticed the description could use more detail. Could you provide additional specifications, photos, or measurements? This will help vendors deliver more accurate quotes.`,
                friendly: `Hey! Your project looks interesting, but I'd love a bit more detail to help find the best vendors. Can you add more specifics, photos, or measurements?`,
                concise: `More details needed for "${job.title}". Please add: specifications, photos, or measurements for accurate vendor quotes.`,
            };

            await addMessage(job.id, customerAgentId(job.userId), 'customer_agent', clarMessages[style] || clarMessages.professional);
            await logAction(job.id, job.userId, 'clarification_sent', 'Requested additional project details from customer',
                { reason: 'description_too_brief' }, customerConfig?.id);
            await createNotification(job.userId, job.id, 'scope_change', 'medium', 'More Details Needed',
                `Your AI agent needs more information about "${job.title}" to find the best vendors.`, true, '/dashboard');

            return NextResponse.json({ status: 'clarification_requested' });
        }

        const { data: vendorRows } = await supabaseAdmin.from('agent_configs').select('*')
            .eq('role', 'vendor')
            .eq('is_active', true);

        const allVendors = (vendorRows || []).map((r: AgentConfigRow) => mapAgentConfigRow(r as AgentConfigRow));
        const budgetNum = job.budget ? parseFloat(String(job.budget).replace(/[^0-9.]/g, '')) : null;

        type MatchResult = { config: typeof allVendors[0]; score: number; reasons: string[] };
        const matched: MatchResult[] = [];
        const rejected: { config: typeof allVendors[0]; reason: string }[] = [];

        for (const vc of allVendors) {
            let score = 0;
            const reasons: string[] = [];

            if (vc.industries.length > 0) {
                if (vc.industries.includes(job.industryVertical)) {
                    score += 30;
                    reasons.push('industry_match');
                } else {
                    rejected.push({ config: vc, reason: 'industry_mismatch' });
                    continue;
                }
            } else {
                score += 10;
                reasons.push('accepts_all_industries');
            }

            if (vc.specialties.length > 0) {
                const jobTerms = [job.subcategory, ...(job.tags || []), job.category].map(s => (s || '').toLowerCase());
                const specialtyMatch = vc.specialties.some((s: string) => jobTerms.some((t: string) => t.includes(s.toLowerCase()) || s.toLowerCase().includes(t)));
                if (specialtyMatch) {
                    score += 25;
                    reasons.push('specialty_match');
                } else {
                    score += 5;
                    reasons.push('no_specialty_match');
                }
            }

            if (vc.maxBudget && budgetNum && budgetNum > vc.maxBudget) {
                rejected.push({ config: vc, reason: 'budget_exceeds_max' });
                continue;
            }
            if (vc.minBudget && budgetNum && budgetNum < vc.minBudget) {
                rejected.push({ config: vc, reason: 'budget_below_min' });
                continue;
            }

            if (budgetNum && vc.minBudget && vc.maxBudget) {
                score += 15;
                reasons.push('budget_in_range');
            }

            if (vc.serviceArea.length > 0 && job.location) {
                const jobLocationLower = job.location.toLowerCase();
                const locationMatch = vc.serviceArea.some((area: string) => {
                    const areaLower = area.toLowerCase();
                    return jobLocationLower.includes(areaLower) || areaLower.includes(jobLocationLower);
                });
                if (locationMatch) {
                    score += 20;
                    reasons.push('location_match');
                } else {
                    rejected.push({ config: vc, reason: 'location_outside_service_area' });
                    continue;
                }
            }

            if (vc.maxActiveJobs) {
                const { count: activeQuoteCount } = await supabaseAdmin
                    .from('quotes')
                    .select('*', { count: 'exact', head: true })
                    .eq('vendor_id', vc.userId)
                    .eq('status', 'ACCEPTED');

                if (activeQuoteCount !== null && activeQuoteCount >= vc.maxActiveJobs) {
                    rejected.push({ config: vc, reason: 'at_capacity' });
                    continue;
                }
                const capacityUsed = activeQuoteCount ? activeQuoteCount / vc.maxActiveJobs : 0;
                if (capacityUsed < 0.5) {
                    score += 10;
                    reasons.push('high_capacity_available');
                } else if (capacityUsed < 0.8) {
                    score += 5;
                    reasons.push('moderate_capacity_available');
                } else {
                    reasons.push('low_capacity_remaining');
                }
            }

            if (vc.workingHoursOnly) {
                const hour = new Date().getUTCHours();
                if (hour < 9 || hour > 17) {
                    score -= 5;
                    reasons.push('outside_working_hours');
                } else {
                    score += 5;
                    reasons.push('within_working_hours');
                }
            }

            if (vc.autoQuote) { score += 10; reasons.push('auto_quote_enabled'); }
            if (vc.autoRespond) { score += 5; reasons.push('auto_respond_enabled'); }

            matched.push({ config: vc, score, reasons });
        }

        matched.sort((a, b) => b.score - a.score);
        const vendorConfigs = matched.map(m => m.config);

        await logAction(job.id, job.userId, 'job_broadcast',
            `Broadcast project to ${vendorConfigs.length} matching vendor agent(s) (${rejected.length} filtered out)`,
            {
                matchedVendors: vendorConfigs.length,
                rejectedVendors: rejected.length,
                industry: job.industryVertical,
                matchScores: matched.map(m => ({ userId: m.config.userId, score: m.score, reasons: m.reasons })),
                rejectionReasons: rejected.map(r => ({ userId: r.config.userId, reason: r.reason })),
            },
            customerConfig?.id);

        await addMessage(job.id, customerAgentId(job.userId), 'customer_agent',
            `Found ${vendorConfigs.length} qualified vendor agent(s) for your project. ${rejected.length > 0 ? `${rejected.length} vendor(s) were filtered out due to criteria mismatch. ` : ''}${vendorConfigs.length > 0 ? 'Initiating quote requests ranked by relevance...' : 'Your project is listed on the marketplace for manual vendor discovery.'}`);

        for (const vc of vendorConfigs) {
            const matchInfo = matched.find(m => m.config.userId === vc.userId);
            await logAction(job.id, vc.userId, 'vendor_match',
                `Vendor agent matched to project "${job.title}" (score: ${matchInfo?.score || 0})`,
                { industry: job.industryVertical, vendorSpecialties: vc.specialties, matchScore: matchInfo?.score, matchReasons: matchInfo?.reasons }, vc.id);

            await createNotification(vc.userId, job.id, 'job_match', 'medium', 'New Project Match',
                `A new ${job.industryVertical} project "${job.title}" matches your expertise.`, false, '/vendor');

            if (vc.autoQuote && vc.baseRate) {
                const hours = estimateHours(job);
                const urgencyMult = job.urgency === 'urgent' ? 1.5 : job.urgency === 'within_week' ? 1.25 : 1.0;

                const template = await findBestTemplate(vc.userId, job);
                let amount: number;
                let detailsText: string;
                let templateName: string | undefined;

                if (template && template.lineItems.length > 0) {
                    const result = calculateFromTemplate(template, job, hours);
                    amount = Math.round(result.amount * urgencyMult);
                    templateName = template.name;
                    detailsText = `Estimate from template "${template.name}" for ${job.industryVertical} / ${job.subcategory}.\n` +
                        result.breakdown.join('\n') +
                        (urgencyMult > 1 ? `\nUrgency multiplier: ${urgencyMult}x` : '') +
                        `\nTotal: $${amount}`;
                } else {
                    const baseRate = vc.baseRate;
                    amount = Math.round(baseRate * hours * urgencyMult);
                    detailsText = `Automated estimate for ${job.industryVertical} / ${job.subcategory}. Based on vendor rate of $${baseRate}/hr. ${job.urgency === 'urgent' ? 'Rush fee included. ' : ''}This is a preliminary estimate.`;
                }

                const estimatedDays = Math.max(1, Math.ceil(hours / 8));

                const { data: profileRow } = await supabaseAdmin
                    .from('vendor_profiles')
                    .select('company_name')
                    .eq('user_id', vc.userId)
                    .maybeSingle();
                const vendorDisplayName = profileRow?.company_name || 'Vendor Agent';

                const { data: insertedQuote, error: quoteError } = await supabaseAdmin.from('quotes').insert({
                    job_id: job.id,
                    vendor_id: vc.userId,
                    vendor_name: vendorDisplayName,
                    amount,
                    estimated_days: estimatedDays,
                    details: detailsText,
                    status: 'PENDING',
                }).select('id').single();

                if (!quoteError && insertedQuote) {
                    await addMessage(job.id, vendorAgentId(vc.userId), 'vendor_agent',
                        `Automated quote submitted: $${amount} for an estimated ${estimatedDays} day(s).${templateName ? ` (Using template: ${templateName})` : ''}`);

                    await logAction(job.id, vc.userId, 'auto_quote',
                        `Auto-generated quote: $${amount} / ${estimatedDays} day(s)${templateName ? ` (template: ${templateName})` : ''}`,
                        { amount, estimatedDays, baseRate: vc.baseRate, urgencyMult, hours, templateName }, vc.id);

                    if (customerConfig?.autoApproveBelow && amount <= customerConfig.autoApproveBelow) {
                        await supabaseAdmin.from('quotes')
                            .update({ status: 'ACCEPTED' })
                            .eq('id', insertedQuote.id);

                        await supabaseAdmin.from('jobs')
                            .update({ status: 'IN_PROGRESS' })
                            .eq('id', job.id);

                        await logAction(job.id, job.userId, 'auto_approve',
                            `Auto-approved quote of $${amount} (below threshold of $${customerConfig.autoApproveBelow})`,
                            { quoteId: insertedQuote.id, amount, threshold: customerConfig.autoApproveBelow }, customerConfig.id);

                        await addMessage(job.id, customerAgentId(job.userId), 'customer_agent',
                            `Quote of $${amount} from Vendor Agent has been auto-approved (below your $${customerConfig.autoApproveBelow} threshold). Project is now in progress.`);

                        await createNotification(job.userId, job.id, 'agent_summary', 'medium', 'Quote Auto-Approved',
                            `Your agent auto-approved a $${amount} quote for "${job.title}" (below your $${customerConfig.autoApproveBelow} threshold).`, false, '/dashboard');

                        await createNotification(vc.userId, job.id, 'milestone', 'high', 'Quote Accepted!',
                            `Your quote of $${amount} for "${job.title}" has been automatically accepted.`, false, '/vendor');
                    } else {
                        await createNotification(job.userId, job.id, 'quote_ready', 'high', 'New Quote Received',
                            `A vendor agent submitted a quote of $${amount} for "${job.title}". Review and approve?`, true, '/dashboard');
                    }

                    await createNotification(vc.userId, job.id, 'agent_summary', 'low', 'Auto-Quote Submitted',
                        `Your agent submitted a $${amount} quote for "${job.title}".`, false);
                }
            } else if (vc.autoRespond) {
                const introMessages: Record<string, string> = {
                    professional: `Hello, I'm reaching out on behalf of a vendor specializing in ${vc.specialties.join(', ') || job.industryVertical}. We'd like to learn more about your project "${job.title}" to provide an accurate estimate.`,
                    friendly: `Hi there! A vendor that specializes in ${vc.specialties.join(', ') || job.industryVertical} is interested in your project!`,
                    concise: `Vendor interested in "${job.title}". Specialties: ${vc.specialties.join(', ') || job.industryVertical}. Requesting details for quote.`,
                };
                await addMessage(job.id, vendorAgentId(vc.userId), 'vendor_agent',
                    introMessages[vc.communicationStyle] || introMessages.professional);
                await logAction(job.id, vc.userId, 'clarification_sent',
                    'Vendor agent sent introduction and requested project details', {}, vc.id);
            }
        }

        if (vendorConfigs.length === 0) {
            await addMessage(job.id, SYSTEM_AGENT_ID, 'system',
                'Your project is now listed on the marketplace. Vendor agents will be notified as they come online.');
        }

        await createNotification(job.userId, job.id, 'agent_summary', 'low', 'Project Broadcast Complete',
            `Your agent broadcast "${job.title}" to ${vendorConfigs.length} vendor(s). Quotes will arrive as vendors respond.`, false, '/dashboard');

        return NextResponse.json({ status: 'processed', vendorsMatched: vendorConfigs.length });
    } catch (error) {
        console.error('Agent processing error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
