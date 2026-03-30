import { supabase } from '@/lib/supabase';
import { Job, Quote, Message, AgentConfig, AgentAction, Notification, IndustryVertical, VendorProfile, EstimatingTemplate, TeamMember, TeamMemberRole, VendorReview, Project, ProjectPhase, CommunityProject, Donation, CommunityProjectUpdate, LedgerEntry } from '@/types';
import {
    JobRow, AgentConfigRow, QuoteRow, MessageRow, AgentActionRow, NotificationRow,
    VendorProfileRow, EstimatingTemplateRow, TeamMemberRow, VendorReviewRow,
    ProjectRow, ProjectPhaseRow,
    CommunityProjectRow, DonationRow, CommunityProjectUpdateRow, LedgerEntryRow,
    mapJobRow, mapAgentConfigRow, mapVendorProfileRow, mapEstimatingTemplateRow,
    mapTeamMemberRow, mapVendorReviewRow, mapProjectRow, mapProjectPhaseRow,
    mapCommunityProjectRow, mapDonationRow, mapCommunityProjectUpdateRow, mapLedgerEntryRow,
} from './serverMappers';

function formatSupabaseError(error: unknown): string {
    if (!error) return 'Unknown error';
    const e = error as Record<string, unknown>;
    const parts: string[] = [];
    if (e.message) parts.push(String(e.message));
    if (e.code) parts.push(`code=${e.code}`);
    if (e.hint) parts.push(`hint: ${e.hint}`);
    if (e.details) parts.push(`details: ${e.details}`);
    return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error);
}

export const db = {
    getJobs: async (userId?: string): Promise<Job[]> => {
        let query = supabase.from('jobs').select('*');
        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching jobs:', formatSupabaseError(error));
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
            const msg = formatSupabaseError(error);
            console.error('Error searching jobs:', msg);
            throw new Error(msg);
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
            community_project_id: job.communityProjectId || null,
            status: 'OPEN'
        }).select().single();

        if (error) throw error;
        return mapJob(data);
    },

    updateJobStatus: async (jobId: string, status: string): Promise<void> => {
        const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
        if (error) console.error('Error updating job status:', formatSupabaseError(error));
    },

    getQuotes: async (jobId: string): Promise<Quote[]> => {
        const { data, error } = await supabase.from('quotes').select('*').eq('job_id', jobId);
        if (error) {
            console.error('Error fetching quotes:', formatSupabaseError(error));
            return [];
        }
        return data.map(mapQuote);
    },

    createQuote: async (quote: Omit<Quote, 'id' | 'createdAt' | 'status'>): Promise<Quote> => {
        const payload: Record<string, unknown> = {
            job_id: quote.jobId,
            vendor_id: quote.vendorId,
            vendor_name: quote.vendorName,
            amount: quote.amount,
            estimated_days: quote.estimatedDays,
            details: quote.details,
            status: 'PENDING',
        };
        if (quote.phaseId) payload.phase_id = quote.phaseId;
        const { data, error } = await supabase.from('quotes').insert(payload).select().single();

        if (error) throw error;
        return mapQuote(data);
    },

    getQuotesByPhase: async (phaseId: string): Promise<Quote[]> => {
        const { data, error } = await supabase.from('quotes').select('*').eq('phase_id', phaseId);
        if (error) {
            console.error('Error fetching phase quotes:', formatSupabaseError(error));
            return [];
        }
        return data.map(mapQuote);
    },

    updateQuoteStatus: async (quoteId: string, status: string): Promise<void> => {
        const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);
        if (error) console.error('Error updating quote status:', formatSupabaseError(error));
    },

    getMessages: async (jobId: string): Promise<Message[]> => {
        const { data, error } = await supabase.from('messages').select('*').eq('job_id', jobId).order('timestamp', { ascending: true });
        if (error) {
            console.error('Error fetching messages:', formatSupabaseError(error));
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
            service_area: config.serviceArea,
            max_active_jobs: config.maxActiveJobs,
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
            console.error('Error fetching agent configs:', formatSupabaseError(error));
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
            console.error('Error fetching agent actions:', formatSupabaseError(error));
            return [];
        }
        return data.map(mapAgentAction);
    },

    getAgentActionsByUser: async (userId: string, limit = 50, offset = 0): Promise<AgentAction[]> => {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            console.error('Error fetching agent actions by user:', formatSupabaseError(error));
            return [];
        }
        return data.map(mapAgentAction);
    },

    getAgentInstructions: async (userId: string, limit = 50, offset = 0): Promise<import('@/types').AgentInstruction[]> => {
        const { data, error } = await supabase
            .from('agent_instructions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            console.error('Error fetching agent instructions:', formatSupabaseError(error));
            return [];
        }
        return (data || []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            userId: row.user_id as string,
            instruction: row.instruction as string,
            acknowledged: row.acknowledged as boolean,
            createdAt: row.created_at as string,
        }));
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
            console.error('Error fetching notifications:', formatSupabaseError(error));
            return [];
        }
        return data.map(mapNotification);
    },

    markNotificationRead: async (notifId: string): Promise<void> => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notifId);
        if (error) console.error('Error marking notification read:', formatSupabaseError(error));
    },

    markAllNotificationsRead: async (userId: string): Promise<void> => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);
        if (error) console.error('Error marking all notifications read:', formatSupabaseError(error));
    },

    getVendorProfile: async (userId: string): Promise<VendorProfile | undefined> => {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (error || !data) return undefined;
        return mapVendorProfileRow(data as VendorProfileRow);
    },

    getVendorProfileById: async (id: string): Promise<VendorProfile | undefined> => {
        const { data, error } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !data) return undefined;
        return mapVendorProfileRow(data as VendorProfileRow);
    },

    upsertVendorProfile: async (profile: Omit<VendorProfile, 'id' | 'createdAt' | 'updatedAt' | 'isVerified' | 'avgRating' | 'totalReviews'>): Promise<VendorProfile> => {
        const existing = await db.getVendorProfile(profile.userId);
        const payload = {
            user_id: profile.userId,
            company_name: profile.companyName,
            company_description: profile.companyDescription,
            contact_email: profile.contactEmail,
            contact_phone: profile.contactPhone,
            website: profile.website,
            logo_url: profile.logoUrl,
            service_areas: profile.serviceAreas,
            industries: profile.industries,
            specialties: profile.specialties,
            certifications: profile.certifications,
            insurance_details: profile.insuranceDetails,
            insurance_expiry: profile.insuranceExpiry,
            license_number: profile.licenseNumber,
            year_established: profile.yearEstablished,
            team_size: profile.teamSize,
            portfolio_images: profile.portfolioImages,
            portfolio_descriptions: profile.portfolioDescriptions,
            updated_at: new Date().toISOString(),
        };

        if (existing) {
            const { data, error } = await supabase
                .from('vendor_profiles')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return mapVendorProfileRow(data as VendorProfileRow);
        } else {
            const { data, error } = await supabase
                .from('vendor_profiles')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            return mapVendorProfileRow(data as VendorProfileRow);
        }
    },

    getEstimatingTemplates: async (vendorProfileId: string): Promise<EstimatingTemplate[]> => {
        const { data, error } = await supabase
            .from('estimating_templates')
            .select('*')
            .eq('vendor_profile_id', vendorProfileId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching estimating templates:', formatSupabaseError(error));
            return [];
        }
        return data.map((row) => mapEstimatingTemplateRow(row as EstimatingTemplateRow));
    },

    createEstimatingTemplate: async (template: Omit<EstimatingTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<EstimatingTemplate> => {
        const { data, error } = await supabase.from('estimating_templates').insert({
            vendor_profile_id: template.vendorProfileId,
            name: template.name,
            service_category: template.serviceCategory,
            industry_vertical: template.industryVertical,
            line_items: template.lineItems,
            labor_rate: template.laborRate,
            material_markup_percent: template.materialMarkupPercent,
            minimum_charge: template.minimumCharge,
            is_default: template.isDefault,
        }).select().single();
        if (error) throw error;
        return mapEstimatingTemplateRow(data as EstimatingTemplateRow);
    },

    updateEstimatingTemplate: async (id: string, template: Partial<Omit<EstimatingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'vendorProfileId'>>): Promise<EstimatingTemplate> => {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (template.name !== undefined) payload.name = template.name;
        if (template.serviceCategory !== undefined) payload.service_category = template.serviceCategory;
        if (template.industryVertical !== undefined) payload.industry_vertical = template.industryVertical;
        if (template.lineItems !== undefined) payload.line_items = template.lineItems;
        if (template.laborRate !== undefined) payload.labor_rate = template.laborRate;
        if (template.materialMarkupPercent !== undefined) payload.material_markup_percent = template.materialMarkupPercent;
        if (template.minimumCharge !== undefined) payload.minimum_charge = template.minimumCharge;
        if (template.isDefault !== undefined) payload.is_default = template.isDefault;

        const { data, error } = await supabase
            .from('estimating_templates')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapEstimatingTemplateRow(data as EstimatingTemplateRow);
    },

    deleteEstimatingTemplate: async (id: string): Promise<void> => {
        const { error } = await supabase.from('estimating_templates').delete().eq('id', id);
        if (error) throw error;
    },

    getTeamMembers: async (vendorProfileId: string): Promise<TeamMember[]> => {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('vendor_profile_id', vendorProfileId)
            .order('invited_at', { ascending: true });
        if (error) {
            console.error('Error fetching team members:', formatSupabaseError(error));
            return [];
        }
        return data.map((row) => mapTeamMemberRow(row as TeamMemberRow));
    },

    addTeamMember: async (member: Omit<TeamMember, 'id' | 'invitedAt' | 'acceptedAt'>): Promise<TeamMember> => {
        const { data, error } = await supabase.from('team_members').insert({
            vendor_profile_id: member.vendorProfileId,
            user_id: member.userId,
            email: member.email,
            name: member.name,
            role: member.role,
            is_active: member.isActive,
        }).select().single();
        if (error) throw error;
        return mapTeamMemberRow(data as TeamMemberRow);
    },

    updateTeamMember: async (id: string, updates: Partial<Pick<TeamMember, 'name' | 'role' | 'isActive'>>): Promise<TeamMember> => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.role !== undefined) payload.role = updates.role;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        const { data, error } = await supabase
            .from('team_members')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapTeamMemberRow(data as TeamMemberRow);
    },

    removeTeamMember: async (id: string): Promise<void> => {
        const { error } = await supabase.from('team_members').delete().eq('id', id);
        if (error) throw error;
    },

    getTeamMemberByUserEmail: async (email: string): Promise<(TeamMember & { vendorOwnerId: string })[]> => {
        const { data, error } = await supabase
            .from('team_members')
            .select('*, vendor_profiles!inner(user_id)')
            .eq('email', email)
            .eq('is_active', true);
        if (error) {
            console.error('Error fetching team membership by email:', formatSupabaseError(error));
            return [];
        }
        return (data || []).map((row) => ({
            ...mapTeamMemberRow(row as unknown as TeamMemberRow),
            vendorOwnerId: ((row as Record<string, unknown>).vendor_profiles as Record<string, unknown>).user_id as string,
        }));
    },

    getTeamMemberByUserId: async (userId: string): Promise<(TeamMember & { vendorOwnerId: string })[]> => {
        const { data, error } = await supabase
            .from('team_members')
            .select('*, vendor_profiles!inner(user_id)')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (error) {
            console.error('Error fetching team membership by userId:', formatSupabaseError(error));
            return [];
        }
        return (data || []).map((row) => ({
            ...mapTeamMemberRow(row as unknown as TeamMemberRow),
            vendorOwnerId: ((row as Record<string, unknown>).vendor_profiles as Record<string, unknown>).user_id as string,
        }));
    },

    acceptTeamInvitation: async (memberId: string, userId: string): Promise<TeamMember> => {
        const { data, error } = await supabase
            .from('team_members')
            .update({ user_id: userId, accepted_at: new Date().toISOString() })
            .eq('id', memberId)
            .select()
            .single();
        if (error) throw error;
        return mapTeamMemberRow(data as TeamMemberRow);
    },

    getVendorProfileByOwnerOrTeam: async (userId: string, userEmail: string): Promise<{ profile: VendorProfile; role: TeamMemberRole | 'owner' } | null> => {
        const ownerProfile = await db.getVendorProfile(userId);
        if (ownerProfile) return { profile: ownerProfile, role: 'owner' };

        const memberships = await db.getTeamMemberByUserEmail(userEmail);
        const accepted = memberships.find(m => m.acceptedAt && m.userId === userId);
        if (!accepted) return null;

        const profile = await db.getVendorProfile(accepted.vendorOwnerId);
        if (!profile) return null;
        return { profile, role: accepted.role };
    },

    getVendorReviews: async (vendorProfileId: string): Promise<VendorReview[]> => {
        const { data, error } = await supabase
            .from('vendor_reviews')
            .select('*')
            .eq('vendor_profile_id', vendorProfileId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching vendor reviews:', formatSupabaseError(error));
            return [];
        }
        return data.map((row) => mapVendorReviewRow(row as VendorReviewRow));
    },

    getProjects: async (userId: string): Promise<Project[]> => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching projects:', formatSupabaseError(error));
            return [];
        }
        return data.map((row) => mapProjectRow(row as ProjectRow));
    },

    getVendorInfoByUserIds: async (userIds: string[]): Promise<Record<string, { rating?: number; isVerified: boolean }>> => {
        if (userIds.length === 0) return {};
        const { data, error } = await supabase
            .from('vendor_profiles')
            .select('user_id, avg_rating, is_verified')
            .in('user_id', userIds);
        if (error || !data) return {};
        const result: Record<string, { rating?: number; isVerified: boolean }> = {};
        for (const row of data) {
            result[row.user_id] = {
                rating: row.avg_rating ?? undefined,
                isVerified: row.is_verified ?? false,
            };
        }
        return result;
    },

    getProject: async (id: string): Promise<Project | undefined> => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return undefined;
        return mapProjectRow(data as ProjectRow);
    },

    createProject: async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Project> => {
        const { data, error } = await supabase.from('projects').insert({
            user_id: project.userId,
            title: project.title,
            description: project.description,
            location: project.location,
            industry_vertical: project.industryVertical,
            total_budget: project.totalBudget,
            start_date: project.startDate,
            end_date: project.endDate,
            status: 'PLANNING',
        }).select().single();
        if (error) throw error;
        return mapProjectRow(data as ProjectRow);
    },

    updateProject: async (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>): Promise<Project> => {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.industryVertical !== undefined) payload.industry_vertical = updates.industryVertical;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.totalBudget !== undefined) payload.total_budget = updates.totalBudget;
        if (updates.startDate !== undefined) payload.start_date = updates.startDate;
        if (updates.endDate !== undefined) payload.end_date = updates.endDate;

        const { data, error } = await supabase
            .from('projects')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapProjectRow(data as ProjectRow);
    },

    deleteProject: async (id: string): Promise<void> => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
    },

    getProjectPhases: async (projectId: string): Promise<ProjectPhase[]> => {
        const { data, error } = await supabase
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('Error fetching project phases:', formatSupabaseError(error));
            return [];
        }
        return data.map((row) => mapProjectPhaseRow(row as ProjectPhaseRow));
    },

    createProjectPhase: async (phase: Omit<ProjectPhase, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectPhase> => {
        const { data, error } = await supabase.from('project_phases').insert({
            project_id: phase.projectId,
            name: phase.name,
            description: phase.description,
            trade_category: phase.tradeCategory,
            status: phase.status || 'NOT_STARTED',
            sort_order: phase.sortOrder,
            depends_on: phase.dependsOn,
            start_date: phase.startDate,
            end_date: phase.endDate,
            estimated_cost: phase.estimatedCost,
            actual_cost: phase.actualCost,
            accepted_quote_id: phase.acceptedQuoteId,
        }).select().single();
        if (error) throw error;
        return mapProjectPhaseRow(data as ProjectPhaseRow);
    },

    updateProjectPhase: async (id: string, updates: Partial<Omit<ProjectPhase, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>>): Promise<ProjectPhase> => {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.tradeCategory !== undefined) payload.trade_category = updates.tradeCategory;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
        if (updates.dependsOn !== undefined) payload.depends_on = updates.dependsOn;
        if ('startDate' in updates) payload.start_date = updates.startDate || null;
        if ('endDate' in updates) payload.end_date = updates.endDate || null;
        if ('estimatedCost' in updates) payload.estimated_cost = updates.estimatedCost ?? null;
        if ('actualCost' in updates) payload.actual_cost = updates.actualCost ?? null;
        if ('acceptedQuoteId' in updates) payload.accepted_quote_id = updates.acceptedQuoteId || null;

        const { data, error } = await supabase
            .from('project_phases')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapProjectPhaseRow(data as ProjectPhaseRow);
    },

    deleteProjectPhase: async (id: string): Promise<void> => {
        const { error } = await supabase.from('project_phases').delete().eq('id', id);
        if (error) throw error;
    },

    getCommunityProjects: async (filters?: { category?: string; status?: string; query?: string }): Promise<CommunityProject[]> => {
        let query = supabase.from('community_projects').select('*').order('created_at', { ascending: false });
        if (filters?.category) query = query.eq('category', filters.category);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.query) {
            query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }
        const { data, error } = await query;
        if (error) { console.error('Error fetching community projects:', formatSupabaseError(error)); return []; }
        return data.map((r) => mapCommunityProjectRow(r as CommunityProjectRow));
    },

    getCommunityProject: async (id: string): Promise<CommunityProject | undefined> => {
        const { data, error } = await supabase.from('community_projects').select('*').eq('id', id).single();
        if (error || !data) return undefined;
        return mapCommunityProjectRow(data as CommunityProjectRow);
    },

    createCommunityProject: async (project: Omit<CommunityProject, 'id' | 'currentFunding' | 'status' | 'createdAt' | 'updatedAt'>): Promise<CommunityProject> => {
        const { data, error } = await supabase.from('community_projects').insert({
            creator_id: project.creatorId,
            creator_name: project.creatorName,
            title: project.title,
            description: project.description,
            category: project.category,
            location: project.location,
            goal_amount: project.goalAmount,
            image_url: project.imageUrl || null,
            contract_address: project.contractAddress || null,
            status: 'ACTIVE',
            current_funding: 0,
        }).select().single();
        if (error) throw error;
        return mapCommunityProjectRow(data as CommunityProjectRow);
    },

    updateCommunityProject: async (id: string, updates: Partial<Pick<CommunityProject, 'title' | 'description' | 'category' | 'location' | 'goalAmount' | 'status' | 'imageUrl' | 'contractAddress'>>): Promise<CommunityProject> => {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.goalAmount !== undefined) payload.goal_amount = updates.goalAmount;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.contractAddress !== undefined) payload.contract_address = updates.contractAddress;
        const { data, error } = await supabase.from('community_projects').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapCommunityProjectRow(data as CommunityProjectRow);
    },

    getDonations: async (communityProjectId: string): Promise<Donation[]> => {
        const { data, error } = await supabase
            .from('donations')
            .select('*')
            .eq('community_project_id', communityProjectId)
            .order('created_at', { ascending: false });
        if (error) { console.error('Error fetching donations:', formatSupabaseError(error)); return []; }
        return data.map((r) => mapDonationRow(r as DonationRow));
    },

    createDonation: async (donation: Omit<Donation, 'id' | 'createdAt'>): Promise<Donation> => {
        const { data, error } = await supabase.from('donations').insert({
            community_project_id: donation.communityProjectId,
            donor_id: donation.donorId || null,
            donor_name: donation.donorName,
            amount: donation.amount,
            is_anonymous: donation.isAnonymous,
            transaction_hash: donation.transactionHash || null,
            message: donation.message || null,
        }).select().single();
        if (error) throw error;
        return mapDonationRow(data as DonationRow);
    },

    getCommunityProjectUpdates: async (communityProjectId: string): Promise<CommunityProjectUpdate[]> => {
        const { data, error } = await supabase
            .from('community_project_updates')
            .select('*')
            .eq('community_project_id', communityProjectId)
            .order('created_at', { ascending: false });
        if (error) { console.error('Error fetching project updates:', formatSupabaseError(error)); return []; }
        return data.map((r) => mapCommunityProjectUpdateRow(r as CommunityProjectUpdateRow));
    },

    createCommunityProjectUpdate: async (update: Omit<CommunityProjectUpdate, 'id' | 'createdAt'>): Promise<CommunityProjectUpdate> => {
        const { data, error } = await supabase.from('community_project_updates').insert({
            community_project_id: update.communityProjectId,
            author_id: update.authorId,
            author_name: update.authorName,
            title: update.title,
            content: update.content,
            image_url: update.imageUrl || null,
        }).select().single();
        if (error) throw error;
        return mapCommunityProjectUpdateRow(data as CommunityProjectUpdateRow);
    },

    getLedgerEntries: async (communityProjectId: string): Promise<LedgerEntry[]> => {
        const { data, error } = await supabase
            .from('ledger_entries')
            .select('*')
            .eq('community_project_id', communityProjectId)
            .order('created_at', { ascending: false });
        if (error) { console.error('Error fetching ledger:', formatSupabaseError(error)); return []; }
        return data.map((r) => mapLedgerEntryRow(r as LedgerEntryRow));
    },
};

function mapJob(row: JobRow): Job {
    return mapJobRow(row);
}

function mapQuote(row: QuoteRow): Quote {
    return {
        id: row.id,
        jobId: row.job_id || undefined,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        amount: row.amount,
        estimatedDays: row.estimated_days,
        details: row.details || '',
        status: row.status as Quote['status'],
        createdAt: row.created_at,
        phaseId: row.phase_id || undefined,
    };
}

function mapMessage(row: MessageRow): Message {
    return {
        id: row.id,
        jobId: row.job_id,
        senderId: row.sender_id,
        senderType: (row.sender_type || 'user') as Message['senderType'],
        content: row.content,
        timestamp: row.timestamp,
        isAgentAction: row.is_agent_action
    };
}

function mapAgentConfig(row: AgentConfigRow): AgentConfig {
    return mapAgentConfigRow(row);
}

function mapAgentAction(row: AgentActionRow): AgentAction {
    return {
        id: row.id,
        jobId: row.job_id,
        agentConfigId: row.agent_config_id || undefined,
        userId: row.user_id,
        actionType: row.action_type as AgentAction['actionType'],
        summary: row.summary,
        details: row.details,
        automated: row.automated,
        createdAt: row.created_at,
    };
}

function mapNotification(row: NotificationRow): Notification {
    return {
        id: row.id,
        userId: row.user_id,
        jobId: row.job_id || undefined,
        type: row.type as Notification['type'],
        priority: row.priority as Notification['priority'],
        title: row.title,
        message: row.message,
        read: row.read,
        actionRequired: row.action_required,
        actionUrl: row.action_url || undefined,
        createdAt: row.created_at,
    };
}
