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

    searchJobs: async (filters: any) => {
        return db.searchJobs(filters);
    },

    createJob: async (jobData: Omit<Job, 'id' | 'createdAt' | 'status'>) => {
        const newJob = await db.createJob(jobData);

        // Trigger AI processing in background
        aiAgent.processNewJob(newJob.id);

        return newJob;
    },

    getJobMessages: async (jobId: string) => {
        return db.getMessages(jobId);
    },

    getJobQuotes: async (jobId: string) => {
        return db.getQuotes(jobId);
    }
};
