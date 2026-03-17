import { Job, Quote, AgentConfig, AgentAction } from '@/types';
import { db } from './db';

export const CUSTOMER_AGENT_PREFIX = 'customer-agent';
export const VENDOR_AGENT_PREFIX = 'vendor-agent';
export const SYSTEM_AGENT_ID = 'system-agent';

function customerAgentId(userId: string): string {
    return `${CUSTOMER_AGENT_PREFIX}-${userId}`;
}

function vendorAgentId(userId: string): string {
    return `${VENDOR_AGENT_PREFIX}-${userId}`;
}

export function isAgentSender(senderId: string): boolean {
    return senderId.startsWith(CUSTOMER_AGENT_PREFIX) ||
           senderId.startsWith(VENDOR_AGENT_PREFIX) ||
           senderId === SYSTEM_AGENT_ID;
}

export function getAgentLabel(senderId: string): string {
    if (senderId === SYSTEM_AGENT_ID) return 'System Agent';
    if (senderId.startsWith(CUSTOMER_AGENT_PREFIX)) return 'Your Agent';
    if (senderId.startsWith(VENDOR_AGENT_PREFIX)) return 'Vendor Agent';
    return 'User';
}

export class AiAgentService {

    async processNewJob(jobId: string): Promise<void> {
        const job = await db.getJob(jobId);
        if (!job) return;

        const customerConfig = await db.getAgentConfig(job.userId);

        await db.addMessage({
            jobId: job.id,
            senderId: customerAgentId(job.userId),
            senderType: 'customer_agent',
            content: `Project "${job.title}" received. Analyzing requirements and searching for matching vendors...`,
            isAgentAction: true,
        });

        await db.logAgentAction({
            jobId: job.id,
            agentConfigId: customerConfig?.id,
            userId: job.userId,
            actionType: 'scope_analysis',
            summary: `Analyzed project scope: ${job.industryVertical} / ${job.subcategory}`,
            details: {
                industry: job.industryVertical,
                subcategory: job.subcategory,
                budget: job.budget,
                urgency: job.urgency,
                location: job.location,
            },
            automated: true,
        });

        if (job.description.length < 30) {
            await this.requestClarification(job, customerConfig);
            return;
        }

        await this.broadcastToVendors(job, customerConfig);
    }

    private async requestClarification(job: Job, config?: AgentConfig): Promise<void> {
        const style = config?.communicationStyle || 'professional';
        const messages: Record<string, string> = {
            professional: `I've reviewed your project "${job.title}" and noticed the description could use more detail. Could you provide additional specifications, photos, or measurements? This will help vendors deliver more accurate quotes.`,
            friendly: `Hey! Your project looks interesting, but I'd love a bit more detail to help find the best vendors. Can you add more specifics, photos, or measurements? The more info, the better quotes you'll get!`,
            concise: `More details needed for "${job.title}". Please add: specifications, photos, or measurements for accurate vendor quotes.`,
        };

        await db.addMessage({
            jobId: job.id,
            senderId: customerAgentId(job.userId),
            senderType: 'customer_agent',
            content: messages[style],
            isAgentAction: true,
        });

        await db.logAgentAction({
            jobId: job.id,
            agentConfigId: config?.id,
            userId: job.userId,
            actionType: 'clarification_sent',
            summary: 'Requested additional project details from customer',
            details: { reason: 'description_too_brief', descriptionLength: job.description.length },
            automated: true,
        });

        await db.createNotification({
            userId: job.userId,
            jobId: job.id,
            type: 'scope_change',
            priority: 'medium',
            title: 'More Details Needed',
            message: `Your AI agent needs more information about "${job.title}" to find the best vendors.`,
            actionRequired: true,
            actionUrl: `/dashboard`,
        });
    }

    private async broadcastToVendors(job: Job, customerConfig?: AgentConfig): Promise<void> {
        const vendorConfigs = await db.getAgentConfigs({
            role: 'vendor',
            isActive: true,
            industries: [job.industryVertical],
        });

        await db.logAgentAction({
            jobId: job.id,
            agentConfigId: customerConfig?.id,
            userId: job.userId,
            actionType: 'job_broadcast',
            summary: `Broadcast project to ${vendorConfigs.length} matching vendor agent(s)`,
            details: {
                matchedVendors: vendorConfigs.length,
                industry: job.industryVertical,
                subcategory: job.subcategory,
            },
            automated: true,
        });

        await db.addMessage({
            jobId: job.id,
            senderId: customerAgentId(job.userId),
            senderType: 'customer_agent',
            content: `Found ${vendorConfigs.length} vendor agent(s) matching your project criteria. ${vendorConfigs.length > 0 ? 'Initiating quote requests...' : 'Expanding search to additional vendors in your area.'}`,
            isAgentAction: true,
        });

        for (const vendorConfig of vendorConfigs) {
            await this.processVendorMatch(job, vendorConfig);
        }

        if (vendorConfigs.length === 0) {
            await db.addMessage({
                jobId: job.id,
                senderId: SYSTEM_AGENT_ID,
                senderType: 'system',
                content: 'Your project is now listed on the marketplace. Vendor agents will be notified as they come online. You can also share the listing link directly with vendors.',
                isAgentAction: true,
            });
        }

        await db.createNotification({
            userId: job.userId,
            jobId: job.id,
            type: 'agent_summary',
            priority: 'low',
            title: 'Project Broadcast Complete',
            message: `Your agent broadcast "${job.title}" to ${vendorConfigs.length} vendor(s). Quotes will arrive as vendors respond.`,
            actionRequired: false,
            actionUrl: `/dashboard`,
        });
    }

    private async processVendorMatch(job: Job, vendorConfig: AgentConfig): Promise<void> {
        await db.logAgentAction({
            jobId: job.id,
            agentConfigId: vendorConfig.id,
            userId: vendorConfig.userId,
            actionType: 'vendor_match',
            summary: `Vendor agent matched to project "${job.title}"`,
            details: {
                industry: job.industryVertical,
                vendorSpecialties: vendorConfig.specialties,
                vendorIndustries: vendorConfig.industries,
            },
            automated: true,
        });

        await db.createNotification({
            userId: vendorConfig.userId,
            jobId: job.id,
            type: 'job_match',
            priority: 'medium',
            title: 'New Project Match',
            message: `A new ${job.industryVertical} project "${job.title}" matches your expertise.`,
            actionRequired: false,
            actionUrl: `/vendor`,
        });

        if (vendorConfig.autoQuote && vendorConfig.baseRate) {
            await this.generateAutoQuote(job, vendorConfig);
        } else if (vendorConfig.autoRespond) {
            await this.sendVendorIntroduction(job, vendorConfig);
        }
    }

    async generateAutoQuote(job: Job, vendorConfig: AgentConfig): Promise<void> {
        const baseRate = vendorConfig.baseRate || 100;
        const urgencyMultiplier = job.urgency === 'urgent' ? 1.5 : job.urgency === 'within_week' ? 1.25 : 1.0;
        const estimatedHours = this.estimateHours(job);
        const amount = Math.round(baseRate * estimatedHours * urgencyMultiplier);

        const budgetNum = job.budget ? parseFloat(job.budget.replace(/[^0-9.]/g, '')) : null;
        if (vendorConfig.maxBudget && budgetNum && budgetNum > vendorConfig.maxBudget) {
            await db.logAgentAction({
                jobId: job.id,
                agentConfigId: vendorConfig.id,
                userId: vendorConfig.userId,
                actionType: 'auto_reject',
                summary: `Auto-rejected: budget $${budgetNum} exceeds vendor max $${vendorConfig.maxBudget}`,
                automated: true,
            });
            return;
        }

        if (vendorConfig.minBudget && amount < vendorConfig.minBudget) {
            await db.logAgentAction({
                jobId: job.id,
                agentConfigId: vendorConfig.id,
                userId: vendorConfig.userId,
                actionType: 'auto_reject',
                summary: `Auto-rejected: estimated quote $${amount} below vendor minimum $${vendorConfig.minBudget}`,
                automated: true,
            });
            return;
        }

        const estimatedDays = Math.max(1, Math.ceil(estimatedHours / 8));

        try {
            await db.createQuote({
                jobId: job.id,
                vendorId: vendorConfig.userId,
                vendorName: `Vendor Agent`,
                amount,
                estimatedDays,
                details: this.generateQuoteDetails(job, vendorConfig, amount, estimatedDays),
            });

            await db.addMessage({
                jobId: job.id,
                senderId: vendorAgentId(vendorConfig.userId),
                senderType: 'vendor_agent',
                content: `Automated quote submitted: $${amount} for an estimated ${estimatedDays} day(s). This quote is based on ${job.industryVertical} / ${job.subcategory} rates and ${job.urgency === 'urgent' ? 'includes a rush fee' : 'standard timeline'}.`,
                isAgentAction: true,
            });

            await db.logAgentAction({
                jobId: job.id,
                agentConfigId: vendorConfig.id,
                userId: vendorConfig.userId,
                actionType: 'auto_quote',
                summary: `Auto-generated quote: $${amount} / ${estimatedDays} day(s)`,
                details: { amount, estimatedDays, baseRate, urgencyMultiplier, estimatedHours },
                automated: true,
            });

            const customerAutoApprove = await db.getAgentConfig(job.userId);
            if (customerAutoApprove?.autoApproveBelow && amount <= customerAutoApprove.autoApproveBelow) {
                await db.logAgentAction({
                    jobId: job.id,
                    agentConfigId: customerAutoApprove.id,
                    userId: job.userId,
                    actionType: 'auto_approve',
                    summary: `Auto-approved quote of $${amount} (below threshold of $${customerAutoApprove.autoApproveBelow})`,
                    automated: true,
                });
            } else {
                await db.createNotification({
                    userId: job.userId,
                    jobId: job.id,
                    type: 'quote_ready',
                    priority: 'high',
                    title: 'New Quote Received',
                    message: `A vendor agent submitted a quote of $${amount} for "${job.title}". Review and approve?`,
                    actionRequired: true,
                    actionUrl: `/dashboard`,
                });
            }

            await db.createNotification({
                userId: vendorConfig.userId,
                jobId: job.id,
                type: 'agent_summary',
                priority: 'low',
                title: 'Auto-Quote Submitted',
                message: `Your agent submitted a $${amount} quote for "${job.title}".`,
                actionRequired: false,
            });
        } catch (error) {
            console.error('Error generating auto-quote:', error);
        }
    }

    private async sendVendorIntroduction(job: Job, vendorConfig: AgentConfig): Promise<void> {
        const style = vendorConfig.communicationStyle || 'professional';
        const messages: Record<string, string> = {
            professional: `Hello, I'm reaching out on behalf of a vendor specializing in ${vendorConfig.specialties.join(', ') || job.industryVertical}. We'd like to learn more about your project "${job.title}" to provide an accurate estimate. Could you confirm the timeline and any specific requirements?`,
            friendly: `Hi there! A vendor that specializes in ${vendorConfig.specialties.join(', ') || job.industryVertical} is interested in your project. They'd love to get a few more details to put together a great quote for you!`,
            concise: `Vendor interested in "${job.title}". Specialties: ${vendorConfig.specialties.join(', ') || job.industryVertical}. Requesting details for quote.`,
        };

        await db.addMessage({
            jobId: job.id,
            senderId: vendorAgentId(vendorConfig.userId),
            senderType: 'vendor_agent',
            content: messages[style],
            isAgentAction: true,
        });

        await db.logAgentAction({
            jobId: job.id,
            agentConfigId: vendorConfig.id,
            userId: vendorConfig.userId,
            actionType: 'clarification_sent',
            summary: 'Vendor agent sent introduction and requested project details',
            automated: true,
        });
    }

    async processQuoteComparison(jobId: string): Promise<void> {
        const job = await db.getJob(jobId);
        if (!job) return;

        const quotes = await db.getQuotes(jobId);
        if (quotes.length < 2) return;

        const sorted = [...quotes].sort((a, b) => a.amount - b.amount);
        const lowest = sorted[0];
        const highest = sorted[sorted.length - 1];
        const avg = Math.round(sorted.reduce((sum, q) => sum + q.amount, 0) / sorted.length);

        await db.addMessage({
            jobId: job.id,
            senderId: customerAgentId(job.userId),
            senderType: 'customer_agent',
            content: `Quote comparison ready: ${quotes.length} quotes received. Range: $${lowest.amount} - $${highest.amount} (avg: $${avg}). Lowest from ${lowest.vendorName}. Review the Quotes tab for details.`,
            isAgentAction: true,
        });

        await db.logAgentAction({
            jobId: job.id,
            userId: job.userId,
            actionType: 'quote_comparison',
            summary: `Compared ${quotes.length} quotes: $${lowest.amount} - $${highest.amount} (avg: $${avg})`,
            details: { quoteCount: quotes.length, lowest: lowest.amount, highest: highest.amount, average: avg },
            automated: true,
        });

        await db.createNotification({
            userId: job.userId,
            jobId: job.id,
            type: 'quote_ready',
            priority: 'high',
            title: 'Quote Comparison Ready',
            message: `${quotes.length} quotes compared for "${job.title}". Best price: $${lowest.amount} from ${lowest.vendorName}.`,
            actionRequired: true,
            actionUrl: `/dashboard`,
        });
    }

    async escalateToHuman(jobId: string, userId: string, reason: string, details?: Record<string, unknown>): Promise<void> {
        const job = await db.getJob(jobId);
        if (!job) return;

        await db.addMessage({
            jobId,
            senderId: SYSTEM_AGENT_ID,
            senderType: 'system',
            content: `⚠️ Human review needed: ${reason}. Your AI agent has paused automated actions on this project until you respond.`,
            isAgentAction: true,
        });

        await db.logAgentAction({
            jobId,
            userId,
            actionType: 'escalation',
            summary: `Escalated to human: ${reason}`,
            details: details || {},
            automated: true,
        });

        await db.createNotification({
            userId,
            jobId,
            type: 'approval_needed',
            priority: 'urgent',
            title: 'Action Required',
            message: reason,
            actionRequired: true,
            actionUrl: `/dashboard`,
        });
    }

    private estimateHours(job: Job): number {
        const sqFt = job.squareFootage ? parseFloat(job.squareFootage.replace(/[^0-9.]/g, '')) : 0;
        const base = sqFt > 0 ? Math.ceil(sqFt / 200) : 8;
        const descComplexity = Math.min(job.description.length / 100, 3);
        return Math.max(2, Math.round(base + descComplexity));
    }

    private generateQuoteDetails(job: Job, config: AgentConfig, amount: number, days: number): string {
        const parts = [
            `Automated estimate for ${job.industryVertical} / ${job.subcategory}`,
            `Based on vendor rate of $${config.baseRate}/hr`,
        ];
        if (job.squareFootage) parts.push(`Area: ${job.squareFootage}`);
        if (job.urgency === 'urgent') parts.push('Rush fee included');
        parts.push(`Estimated timeline: ${days} business day(s)`);
        parts.push('This is a preliminary estimate. Final pricing may vary based on on-site assessment.');
        return parts.join('. ') + '.';
    }
}

export const aiAgent = new AiAgentService();
