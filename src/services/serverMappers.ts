import { Job, AgentConfig, IndustryVertical } from '@/types';

export interface JobRow {
    id: string;
    user_id: string;
    title: string;
    category: string;
    description: string;
    location: string;
    status: string;
    created_at: string;
    tags: string[] | null;
    is_public: boolean;
    requires_permit: boolean;
    budget: string | null;
    industry_vertical: string;
    subcategory: string;
    urgency: string;
    square_footage: string | null;
    materials: string | null;
    attachments: string[] | null;
    timeline_start: string | null;
    timeline_end: string | null;
}

export interface AgentConfigRow {
    id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    auto_respond: boolean;
    auto_quote: boolean;
    max_budget: number | null;
    min_budget: number | null;
    industries: string[] | null;
    specialties: string[] | null;
    max_distance: number | null;
    base_rate: number | null;
    communication_style: string;
    escalation_triggers: string[] | null;
    auto_approve_below: number | null;
    working_hours_only: boolean;
    created_at: string;
    updated_at: string;
}

export interface QuoteRow {
    id: string;
    job_id: string;
    vendor_id: string;
    vendor_name: string;
    amount: number;
    estimated_days: number;
    details: string | null;
    status: string;
    created_at: string;
}

export interface MessageRow {
    id: string;
    job_id: string;
    sender_id: string;
    sender_type: string;
    content: string;
    timestamp: string;
    is_agent_action: boolean;
}

export interface AgentActionRow {
    id: string;
    job_id: string;
    agent_config_id: string | null;
    user_id: string;
    action_type: string;
    summary: string;
    details: Record<string, unknown>;
    automated: boolean;
    created_at: string;
}

export interface NotificationRow {
    id: string;
    user_id: string;
    job_id: string | null;
    type: string;
    priority: string;
    title: string;
    message: string;
    read: boolean;
    action_required: boolean;
    action_url: string | null;
    created_at: string;
}

export function mapJobRow(row: JobRow): Job {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        category: row.category,
        description: row.description,
        location: row.location,
        status: row.status as Job['status'],
        createdAt: row.created_at,
        tags: row.tags || [],
        isPublic: row.is_public,
        requiresPermit: row.requires_permit,
        budget: row.budget || undefined,
        industryVertical: (row.industry_vertical || 'Other') as IndustryVertical,
        subcategory: row.subcategory || 'Other',
        urgency: (row.urgency || 'flexible') as Job['urgency'],
        squareFootage: row.square_footage || undefined,
        materials: row.materials || undefined,
        attachments: row.attachments || [],
        timelineStart: row.timeline_start || undefined,
        timelineEnd: row.timeline_end || undefined,
    };
}

export function mapAgentConfigRow(row: AgentConfigRow): AgentConfig {
    return {
        id: row.id,
        userId: row.user_id,
        role: row.role as AgentConfig['role'],
        isActive: row.is_active,
        autoRespond: row.auto_respond,
        autoQuote: row.auto_quote,
        maxBudget: row.max_budget ?? undefined,
        minBudget: row.min_budget ?? undefined,
        industries: (row.industries || []) as IndustryVertical[],
        specialties: row.specialties || [],
        maxDistance: row.max_distance ?? undefined,
        baseRate: row.base_rate ?? undefined,
        communicationStyle: (row.communication_style || 'professional') as AgentConfig['communicationStyle'],
        escalationTriggers: (row.escalation_triggers || []) as AgentConfig['escalationTriggers'],
        autoApproveBelow: row.auto_approve_below ?? undefined,
        workingHoursOnly: row.working_hours_only,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function customerAgentId(userId: string): string {
    return `customer-agent-${userId}`;
}

export function vendorAgentId(userId: string): string {
    return `vendor-agent-${userId}`;
}

export const SYSTEM_AGENT_ID = 'system-agent';

export function estimateHours(job: Job): number {
    const sqFt = job.squareFootage ? parseFloat(String(job.squareFootage).replace(/[^0-9.]/g, '')) : 0;
    const base = sqFt > 0 ? Math.ceil(sqFt / 200) : 8;
    const descComplexity = Math.min((job.description || '').length / 100, 3);
    return Math.max(2, Math.round(base + descComplexity));
}
