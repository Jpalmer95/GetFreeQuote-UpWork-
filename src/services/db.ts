import { supabase } from '@/lib/supabase';
import { Job, Quote, Message, AgentConfig, AgentAction, Notification, IndustryVertical } from '@/types';

export const db = {
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
        location?: string;
        industryVertical?: string;
        subcategory?: string;
        urgency?: string;
    }): Promise<Job[]> => {
        let query = supabase.from('jobs').select('*').eq('is_public', true);

        if (filters.category) {
            query = query.eq('category', filters.category);
        }

        if (filters.industryVertical) {
            query = query.eq('industry_vertical', filters.industryVertical);
        }

        if (filters.subcategory) {
            query = query.eq('subcategory', filters.subcategory);
        }

        if (filters.urgency) {
            query = query.eq('urgency', filters.urgency);
        }

        if (filters.requiresPermit !== undefined) {
            query = query.eq('requires_permit', filters.requiresPermit);
        }

        if (filters.location) {
            query = query.ilike('location', `%${filters.location}%`);
        }

        if (filters.query) {
            query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error searching jobs:', error);
            return [];
        }

        let results = data.map(mapJob);

        if (filters.query) {
            const lowerQ = filters.query.toLowerCase();
            results = results.filter(j =>
                j.title.toLowerCase().includes(lowerQ) ||
                j.description.toLowerCase().includes(lowerQ) ||
                j.tags.some(t => t.toLowerCase().includes(lowerQ))
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
            industry_vertical: job.industryVertical,
            subcategory: job.subcategory,
            urgency: job.urgency || 'flexible',
            square_footage: job.squareFootage,
            materials: job.materials,
            attachments: job.attachments || [],
            timeline_start: job.timelineStart,
            timeline_end: job.timelineEnd,
            status: 'OPEN'
        }).select().single();

        if (error) throw error;
        return mapJob(data);
    },

    updateJobStatus: async (jobId: string, status: string): Promise<void> => {
        const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
        if (error) console.error('Error updating job status:', error);
    },

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

    updateQuoteStatus: async (quoteId: string, status: string): Promise<void> => {
        const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);
        if (error) console.error('Error updating quote status:', error);
    },

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
            sender_type: msg.senderType || 'system',
            content: msg.content,
            is_agent_action: msg.isAgentAction || false
        }).select().single();

        if (error) throw error;
        return mapMessage(data);
    },

    getAgentConfig: async (userId: string): Promise<AgentConfig | undefined> => {
        const { data, error } = await supabase
            .from('agent_configs')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (error || !data) return undefined;
        return mapAgentConfig(data);
    },

    upsertAgentConfig: async (config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentConfig> => {
        const existing = await db.getAgentConfig(config.userId);

        const payload = {
            user_id: config.userId,
            role: config.role,
            is_active: config.isActive,
            auto_respond: config.autoRespond,
            auto_quote: config.autoQuote,
            max_budget: config.maxBudget,
            min_budget: config.minBudget,
            industries: config.industries,
            specialties: config.specialties,
            max_distance: config.maxDistance,
            base_rate: config.baseRate,
            communication_style: config.communicationStyle,
            escalation_triggers: config.escalationTriggers,
            auto_approve_below: config.autoApproveBelow,
            working_hours_only: config.workingHoursOnly,
            updated_at: new Date().toISOString(),
        };

        if (existing) {
            const { data, error } = await supabase
                .from('agent_configs')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return mapAgentConfig(data);
        } else {
            const { data, error } = await supabase
                .from('agent_configs')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            return mapAgentConfig(data);
        }
    },

    getAgentConfigs: async (filters?: { role?: string; isActive?: boolean; industries?: string[] }): Promise<AgentConfig[]> => {
        let query = supabase.from('agent_configs').select('*');

        if (filters?.role) query = query.eq('role', filters.role);
        if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching agent configs:', error);
            return [];
        }

        let configs = data.map(mapAgentConfig);

        if (filters?.industries && filters.industries.length > 0) {
            configs = configs.filter(c =>
                c.industries.length === 0 ||
                c.industries.some(ind => filters.industries!.includes(ind))
            );
        }

        return configs;
    },

    logAgentAction: async (action: Omit<AgentAction, 'id' | 'createdAt'>): Promise<AgentAction> => {
        const { data, error } = await supabase.from('agent_actions').insert({
            job_id: action.jobId,
            agent_config_id: action.agentConfigId,
            user_id: action.userId,
            action_type: action.actionType,
            summary: action.summary,
            details: action.details || {},
            automated: action.automated,
        }).select().single();

        if (error) throw error;
        return mapAgentAction(data);
    },

    getAgentActions: async (jobId: string): Promise<AgentAction[]> => {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching agent actions:', error);
            return [];
        }
        return data.map(mapAgentAction);
    },

    createNotification: async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification> => {
        const { data, error } = await supabase.from('notifications').insert({
            user_id: notif.userId,
            job_id: notif.jobId,
            type: notif.type,
            priority: notif.priority,
            title: notif.title,
            message: notif.message,
            action_required: notif.actionRequired,
            action_url: notif.actionUrl,
            read: false,
        }).select().single();

        if (error) throw error;
        return mapNotification(data);
    },

    getNotifications: async (userId: string, unreadOnly?: boolean): Promise<Notification[]> => {
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (unreadOnly) query = query.eq('read', false);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
        return data.map(mapNotification);
    },

    markNotificationRead: async (notifId: string): Promise<void> => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notifId);
        if (error) console.error('Error marking notification read:', error);
    },

    markAllNotificationsRead: async (userId: string): Promise<void> => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);
        if (error) console.error('Error marking all notifications read:', error);
    },
};

function mapJob(row: any): Job {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        category: row.category,
        description: row.description,
        location: row.location,
        status: row.status,
        createdAt: row.created_at,
        tags: row.tags || [],
        isPublic: row.is_public,
        requiresPermit: row.requires_permit,
        budget: row.budget,
        industryVertical: row.industry_vertical || 'Other',
        subcategory: row.subcategory || 'Other',
        urgency: row.urgency,
        squareFootage: row.square_footage,
        materials: row.materials,
        attachments: row.attachments || [],
        timelineStart: row.timeline_start,
        timelineEnd: row.timeline_end,
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
        senderType: row.sender_type || 'user',
        content: row.content,
        timestamp: row.timestamp,
        isAgentAction: row.is_agent_action
    };
}

function mapAgentConfig(row: any): AgentConfig {
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapAgentAction(row: any): AgentAction {
    return {
        id: row.id,
        jobId: row.job_id,
        agentConfigId: row.agent_config_id,
        userId: row.user_id,
        actionType: row.action_type,
        summary: row.summary,
        details: row.details,
        automated: row.automated,
        createdAt: row.created_at,
    };
}

function mapNotification(row: any): Notification {
    return {
        id: row.id,
        userId: row.user_id,
        jobId: row.job_id,
        type: row.type,
        priority: row.priority,
        title: row.title,
        message: row.message,
        read: row.read,
        actionRequired: row.action_required,
        actionUrl: row.action_url,
        createdAt: row.created_at,
    };
}
