import { db } from './db';
import { aiAgent } from './aiAgent';
import { Job } from '@/types';

export const jobService = {
    getMyJobs: async (userId: string) => {
        return db.getJobs(userId);
    },

    getJobDetails: async (jobId: string) => {
        return db.getJob(jobId);
    },

    searchJobs: async (filters: {
        query?: string;
        category?: string;
        requiresPermit?: boolean;
        location?: string;
        industryVertical?: string;
        subcategory?: string;
        urgency?: string;
    }) => {
        return db.searchJobs(filters);
    },

    createJob: async (jobData: Omit<Job, 'id' | 'createdAt' | 'status'>) => {
        const newJob = await db.createJob(jobData);

        aiAgent.processNewJob(newJob.id).catch(err => {
            console.error('AI agent processing error:', err);
        });

        return newJob;
    },

    getJobMessages: async (jobId: string) => {
        return db.getMessages(jobId);
    },

    getJobQuotes: async (jobId: string) => {
        return db.getQuotes(jobId);
    },

    acceptQuote: async (quoteId: string) => {
        await db.updateQuoteStatus(quoteId, 'ACCEPTED');
    },

    rejectQuote: async (quoteId: string) => {
        await db.updateQuoteStatus(quoteId, 'REJECTED');
    },
};
