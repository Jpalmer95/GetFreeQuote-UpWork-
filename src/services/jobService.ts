import { db } from './db';
import { Job } from '@/types';
import { supabase } from '@/lib/supabase';
import { withWorkKindTags } from '@/lib/workKind';

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
        const kind = jobData.workKind || (jobData.isLocalRequest ? 'local' : 'quote');
        const newJob = await db.createJob({
            ...jobData,
            workKind: kind,
            tags: withWorkKindTags(jobData.tags, kind),
            isLocalRequest: kind === 'local' || !!jobData.isLocalRequest,
        });

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
        return res.json();
    },

    completeJob: async (jobId: string) => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/jobs/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ jobId }),
        });
        if (!res.ok) throw new Error('Failed to complete job');
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

    updateJob: async (jobId: string, patch: Record<string, unknown>) => {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/jobs/${jobId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patch),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to update job');
        return json.job;
    },

    cancelJob: async (jobId: string) => {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE', headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to cancel job');
        return json.job;
    },
};
