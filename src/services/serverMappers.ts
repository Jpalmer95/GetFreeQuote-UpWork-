import { Job, AgentConfig, IndustryVertical, VendorProfile, EstimatingTemplate, EstimatingLineItem, TeamMember, VendorReview, Project, ProjectPhase, CommunityProject, Donation, CommunityProjectUpdate, LedgerEntry } from '@/types';

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
    budget_min: number | null;
    budget_max: number | null;
    industry_vertical: string;
    subcategory: string;
    urgency: string;
    square_footage: string | null;
    materials: string | null;
    attachments: string[] | null;
    timeline_start: string | null;
    timeline_end: string | null;
    community_project_id: string | null;
    last_reminded_at: string | null;
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
    service_area: string[] | null;
    max_active_jobs: number | null;
    created_at: string;
    updated_at: string;
}

export interface QuoteRow {
    id: string;
    job_id: string | null;
    vendor_id: string;
    vendor_name: string;
    amount: number;
    estimated_days: number;
    details: string | null;
    status: string;
    created_at: string;
    phase_id: string | null;
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
    job_id: string | null;
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
        communityProjectId: row.community_project_id || undefined,
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
        serviceArea: row.service_area || [],
        maxActiveJobs: row.max_active_jobs ?? undefined,
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

export interface VendorProfileRow {
    id: string;
    user_id: string;
    company_name: string;
    company_description: string;
    contact_email: string;
    contact_phone: string;
    website: string | null;
    logo_url: string | null;
    service_areas: string[] | null;
    industries: string[] | null;
    specialties: string[] | null;
    certifications: string[] | null;
    insurance_details: string | null;
    insurance_expiry: string | null;
    license_number: string | null;
    year_established: number | null;
    team_size: number;
    portfolio_images: string[] | null;
    portfolio_descriptions: string[] | null;
    is_verified: boolean;
    avg_rating: number | null;
    total_reviews: number;
    created_at: string;
    updated_at: string;
}

export function mapVendorProfileRow(row: VendorProfileRow): VendorProfile {
    return {
        id: row.id,
        userId: row.user_id,
        companyName: row.company_name,
        companyDescription: row.company_description,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        website: row.website || undefined,
        logoUrl: row.logo_url || undefined,
        serviceAreas: row.service_areas || [],
        industries: (row.industries || []) as IndustryVertical[],
        specialties: row.specialties || [],
        certifications: row.certifications || [],
        insuranceDetails: row.insurance_details || undefined,
        insuranceExpiry: row.insurance_expiry || undefined,
        licenseNumber: row.license_number || undefined,
        yearEstablished: row.year_established ?? undefined,
        teamSize: row.team_size,
        portfolioImages: row.portfolio_images || [],
        portfolioDescriptions: row.portfolio_descriptions || [],
        isVerified: row.is_verified,
        avgRating: row.avg_rating ?? undefined,
        totalReviews: row.total_reviews,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface EstimatingTemplateRow {
    id: string;
    vendor_profile_id: string;
    name: string;
    service_category: string;
    industry_vertical: string;
    line_items: EstimatingLineItem[];
    labor_rate: number;
    material_markup_percent: number;
    minimum_charge: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export function mapEstimatingTemplateRow(row: EstimatingTemplateRow): EstimatingTemplate {
    return {
        id: row.id,
        vendorProfileId: row.vendor_profile_id,
        name: row.name,
        serviceCategory: row.service_category,
        industryVertical: row.industry_vertical as IndustryVertical,
        lineItems: Array.isArray(row.line_items) ? row.line_items : [],
        laborRate: row.labor_rate,
        materialMarkupPercent: row.material_markup_percent,
        minimumCharge: row.minimum_charge,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface TeamMemberRow {
    id: string;
    vendor_profile_id: string;
    user_id: string | null;
    email: string;
    name: string;
    role: string;
    is_active: boolean;
    invited_at: string;
    accepted_at: string | null;
}

export function mapTeamMemberRow(row: TeamMemberRow): TeamMember {
    return {
        id: row.id,
        vendorProfileId: row.vendor_profile_id,
        userId: row.user_id || undefined,
        email: row.email,
        name: row.name,
        role: row.role as TeamMember['role'],
        isActive: row.is_active,
        invitedAt: row.invited_at,
        acceptedAt: row.accepted_at || undefined,
    };
}

export interface VendorReviewRow {
    id: string;
    vendor_profile_id: string;
    reviewer_id: string;
    reviewer_name: string;
    job_id: string;
    rating: number;
    comment: string;
    created_at: string;
}

export function mapVendorReviewRow(row: VendorReviewRow): VendorReview {
    return {
        id: row.id,
        vendorProfileId: row.vendor_profile_id,
        reviewerId: row.reviewer_id,
        reviewerName: row.reviewer_name,
        jobId: row.job_id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
    };
}

export interface ProjectRow {
    id: string;
    user_id: string;
    title: string;
    description: string;
    location: string;
    industry_vertical: string;
    status: string;
    total_budget: number | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export function mapProjectRow(row: ProjectRow): Project {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        location: row.location,
        industryVertical: (row.industry_vertical || 'Other') as IndustryVertical,
        status: row.status as Project['status'],
        totalBudget: row.total_budget ?? undefined,
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface ProjectPhaseRow {
    id: string;
    project_id: string;
    name: string;
    description: string;
    trade_category: string;
    status: string;
    sort_order: number;
    depends_on: string[] | null;
    start_date: string | null;
    end_date: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    accepted_quote_id: string | null;
    created_at: string;
    updated_at: string;
}

export function mapProjectPhaseRow(row: ProjectPhaseRow): ProjectPhase {
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        tradeCategory: row.trade_category,
        status: row.status as ProjectPhase['status'],
        sortOrder: row.sort_order,
        dependsOn: row.depends_on || [],
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        estimatedCost: row.estimated_cost ?? undefined,
        actualCost: row.actual_cost ?? undefined,
        acceptedQuoteId: row.accepted_quote_id || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface CommunityProjectRow {
    id: string;
    creator_id: string;
    creator_name: string;
    title: string;
    description: string;
    category: string;
    location: string;
    goal_amount: number;
    current_funding: number;
    status: string;
    image_url: string | null;
    contract_address: string | null;
    created_at: string;
    updated_at: string;
}

export function mapCommunityProjectRow(row: CommunityProjectRow): CommunityProject {
    return {
        id: row.id,
        creatorId: row.creator_id,
        creatorName: row.creator_name,
        title: row.title,
        description: row.description,
        category: row.category as CommunityProject['category'],
        location: row.location,
        goalAmount: row.goal_amount,
        currentFunding: row.current_funding,
        status: row.status as CommunityProject['status'],
        imageUrl: row.image_url || undefined,
        contractAddress: row.contract_address || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface DonationRow {
    id: string;
    community_project_id: string;
    donor_id: string | null;
    donor_name: string;
    amount: number;
    is_anonymous: boolean;
    transaction_hash: string | null;
    message: string | null;
    created_at: string;
}

export function mapDonationRow(row: DonationRow): Donation {
    return {
        id: row.id,
        communityProjectId: row.community_project_id,
        donorId: row.is_anonymous ? undefined : (row.donor_id || undefined),
        donorName: row.is_anonymous ? 'Anonymous' : row.donor_name,
        amount: row.amount,
        isAnonymous: row.is_anonymous,
        transactionHash: row.transaction_hash || undefined,
        message: row.message || undefined,
        createdAt: row.created_at,
    };
}

export interface CommunityProjectUpdateRow {
    id: string;
    community_project_id: string;
    author_id: string;
    author_name: string;
    title: string;
    content: string;
    image_url: string | null;
    created_at: string;
}

export function mapCommunityProjectUpdateRow(row: CommunityProjectUpdateRow): CommunityProjectUpdate {
    return {
        id: row.id,
        communityProjectId: row.community_project_id,
        authorId: row.author_id,
        authorName: row.author_name,
        title: row.title,
        content: row.content,
        imageUrl: row.image_url || undefined,
        createdAt: row.created_at,
    };
}

export interface LedgerEntryRow {
    id: string;
    community_project_id: string;
    type: string;
    amount: number;
    description: string;
    reference_id: string | null;
    transaction_hash: string | null;
    created_at: string;
}

export function mapLedgerEntryRow(row: LedgerEntryRow): LedgerEntry {
    return {
        id: row.id,
        communityProjectId: row.community_project_id,
        type: row.type as LedgerEntry['type'],
        amount: row.amount,
        description: row.description,
        referenceId: row.reference_id || undefined,
        transactionHash: row.transaction_hash || undefined,
        createdAt: row.created_at,
    };
}
