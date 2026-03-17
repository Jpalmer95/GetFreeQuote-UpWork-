import { Job, Quote, Message } from '@/types';
import { db } from './db';

export const AI_AGENT_ID = 'system-agent';

export class AiAgentService {

    // Simulate analyzing a job posting
    async processNewJob(jobId: string): Promise<void> {
        const job = await db.getJob(jobId);
        if (!job) return;

        // Simulate "thinking" delay
        await new Promise(r => setTimeout(r, 1500));

        // 1. Check for missing details (Heuristic mock)
        // If description is short, ask for more info.
        if (job.description.length < 20) {
            await db.addMessage({
                jobId: job.id,
                senderId: AI_AGENT_ID,
                content: "I noticed your description is a bit brief. Could you provide a photo or specify the material? This will help vendors quote accurately.",
                isAgentAction: true
            });
            return;
        }

        // 2. If details are good, trigger "Vendor Agents" to quote
        // DISABLED for live production - waiting for real vendors
        // this.triggerVendorQuotes(job);
    }

    async triggerVendorQuotes(job: Job): Promise<void> {
        // Disabled
        /*
        // Simulate multiple vendors responding over time
        const vendors = [
            { id: 'vendor-1', name: "Bob's Plumbing", baseRate: 100 },
            { id: 'vendor-2', name: "Alice Electric", baseRate: 120 } // Alice does plumbing too in this mock world?
        ];

        for (const vendor of vendors) {
            // Staggered response
            await new Promise(r => setTimeout(r, 2000));

            const estimatedPrice = vendor.baseRate + (Math.random() * 50);

            db.createQuote({
                jobId: job.id,
                vendorId: vendor.id,
                vendorName: vendor.name,
                amount: Math.floor(estimatedPrice),
                estimatedDays: Math.floor(Math.random() * 3) + 1,
                details: `Automated quote based on "${job.tags[0]}" parameters.`
            });

            // Optional: Notify user
            // (In a real app, this would push a notification)
        }

        // Final Summary Message
        db.addMessage({
            jobId: job.id,
            senderId: AI_AGENT_ID,
            content: "I've gathered 2 preliminary quotes for you based on your job details. Check the 'Quotes' tab.",
            isAgentAction: true
        });
        */
    }
}

export const aiAgent = new AiAgentService();
