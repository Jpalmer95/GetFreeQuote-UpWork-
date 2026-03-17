import { db } from './db';
import { Job } from '@/types';
import { supabase } from '@/lib/supabase';

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

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

        getAuthHeaders().then(headers => {
            fetch('/api/agent-process', {
                method: 'POST',
                headers,
                body: JSON.stringify({ jobId: newJob.id }),
            }).catch(err => {
                console.error('Agent processing trigger error:', err);
            });
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
        const headers = await getAuthHeaders();
        const res = await fetch('/api/quote-action', {
            method: 'POST',
            headers,
            body: JSON.stringify({ quoteId, action: 'accept' }),
        });
        if (!res.ok) throw new Error('Failed to accept quote');
    },

    rejectQuote: async (quoteId: string) => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/quote-action', {
            method: 'POST',
            headers,
            body: JSON.stringify({ quoteId, action: 'reject' }),
        });
        if (!res.ok) throw new Error('Failed to reject quote');
    },
};
