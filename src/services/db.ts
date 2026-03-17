import { supabase } from '@/lib/supabase';
import { Job, Quote, Message, JobCategory } from '@/types';

export const db = {
    // Jobs
    getJobs: async (userId?: string): Promise<Job[]> => {
        let query = supabase.from('jobs').select('*');
        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching jobs:', error);
            return [];
        }
        return data.map(mapJob);
    },

    searchJobs: async (filters: {
        query?: string;
        category?: string;
        requiresPermit?: boolean;
        location?: string
    }): Promise<Job[]> => {
        let query = supabase.from('jobs').select('*').eq('is_public', true);

        if (filters.category) {
            query = query.eq('category', filters.category);
        }

        if (filters.requiresPermit !== undefined) {
            query = query.eq('requires_permit', filters.requiresPermit);
        }

        if (filters.location) {
            query = query.ilike('location', `%${filters.location}%`);
        }

        // For text search (title, description, tags), simple ILIKE OR logic is hard in single Supabase call without specific search index or RPC.
        // We will filter client-side for complex text match if needed, OR use simple ilike on title for now.
        // Implementing proper text search:
        if (filters.query) {
            // Supabase 'or' syntax: width filters
            query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error searching jobs:', error);
            return [];
        }

        // Post-filter for tags if needed (since OR query above might miss tags or be too simple)
        let results = data.map(mapJob);

        if (filters.query) {
            const lowerQ = filters.query.toLowerCase();
            results = results.filter(j =>
                j.title.toLowerCase().includes(lowerQ) ||
                j.description.toLowerCase().includes(lowerQ) ||
                j.tags.some(t => t.toLowerCase().includes(lowerQ)) // Check tags here
            );
        }

        return results;
    },

    getJob: async (id: string): Promise<Job | undefined> => {
        const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapJob(data);
    },

    createJob: async (job: Omit<Job, 'id' | 'createdAt' | 'status'>): Promise<Job> => {
        const { data, error } = await supabase.from('jobs').insert({
            user_id: job.userId,
            title: job.title,
            category: job.category,
            description: job.description,
            location: job.location,
            tags: job.tags,
            is_public: job.isPublic,
            requires_permit: job.requiresPermit,
            budget: job.budget,
            status: 'OPEN'
        }).select().single();

        if (error) throw error;
        return mapJob(data);
    },

    // Quotes
    getQuotes: async (jobId: string): Promise<Quote[]> => {
        const { data, error } = await supabase.from('quotes').select('*').eq('job_id', jobId);
        if (error) {
            console.error('Error fetching quotes:', error);
            return [];
        }
        return data.map(mapQuote);
    },

    createQuote: async (quote: Omit<Quote, 'id' | 'createdAt' | 'status'>): Promise<Quote> => {
        const { data, error } = await supabase.from('quotes').insert({
            job_id: quote.jobId,
            vendor_id: quote.vendorId,
            vendor_name: quote.vendorName,
            amount: quote.amount,
            estimated_days: quote.estimatedDays,
            details: quote.details,
            status: 'PENDING'
        }).select().single();

        if (error) throw error;
        return mapQuote(data);
    },

    // Messages
    getMessages: async (jobId: string): Promise<Message[]> => {
        const { data, error } = await supabase.from('messages').select('*').eq('job_id', jobId).order('timestamp', { ascending: true });
        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
        return data.map(mapMessage);
    },

    addMessage: async (msg: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
        const { data, error } = await supabase.from('messages').insert({
            job_id: msg.jobId,
            sender_id: msg.senderId,
            content: msg.content,
            is_agent_action: msg.isAgentAction || false
        }).select().single();

        if (error) throw error;
        return mapMessage(data);
    }
};

// Mappers
function mapJob(row: any): Job {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        category: row.category as JobCategory,
        description: row.description,
        location: row.location,
        status: row.status,
        createdAt: row.created_at,
        tags: row.tags || [],
        isPublic: row.is_public,
        requiresPermit: row.requires_permit,
        budget: row.budget
    };
}

function mapQuote(row: any): Quote {
    return {
        id: row.id,
        jobId: row.job_id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        amount: row.amount,
        estimatedDays: row.estimated_days,
        details: row.details,
        status: row.status,
        createdAt: row.created_at
    };
}

function mapMessage(row: any): Message {
    return {
        id: row.id,
        jobId: row.job_id,
        senderId: row.sender_id,
        content: row.content,
        timestamp: row.timestamp,
        isAgentAction: row.is_agent_action
    };
}
