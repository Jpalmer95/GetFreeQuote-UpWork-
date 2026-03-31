export type UserRole = 'USER' | 'VENDOR' | 'ADMIN';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}

export type KnownIndustryVertical =
    | 'Home Services'
    | 'Commercial Construction'
    | 'Gig Work'
    | 'Events & Entertainment'
    | 'Trade Labor'
    | 'Day Labor'
    | 'Professional Services'
    | 'Technology'
    | 'Other';

export type IndustryVertical = KnownIndustryVertical | (string & {});

export const INDUSTRY_VERTICALS: KnownIndustryVertical[] = [
    'Home Services',
    'Commercial Construction',
    'Gig Work',
    'Events & Entertainment',
    'Trade Labor',
    'Day Labor',
    'Professional Services',
    'Technology',
    'Other',
];

export const INDUSTRY_SUBCATEGORIES: Record<KnownIndustryVertical, string[]> = {
    'Home Services': ['Plumbing', 'Electrical', 'HVAC', 'Roofing', 'Painting', 'Landscaping', 'Cleaning', 'Pest Control', 'Handyman', 'Other'],
    'Commercial Construction': ['General Contracting', 'Concrete & Foundation', 'Steel & Framing', 'Electrical Systems', 'Mechanical / HVAC', 'Plumbing Systems', 'Interior Finish', 'Demolition', 'Site Work', 'Other'],
    'Gig Work': ['Delivery', 'Moving & Hauling', 'Assembly', 'Personal Shopping', 'Pet Care', 'Tutoring', 'Photography', 'Videography', 'Other'],
    'Events & Entertainment': ['Catering', 'DJ / Music', 'Photography', 'Videography', 'Venue Rental', 'Event Planning', 'Floral Design', 'Lighting & AV', 'Other'],
    'Trade Labor': ['Welding', 'Carpentry', 'Masonry', 'Tile Work', 'Drywall', 'Insulation', 'Glazing', 'Flooring', 'Other'],
    'Day Labor': ['General Labor', 'Warehouse', 'Construction Help', 'Yard Work', 'Clean-Up', 'Loading / Unloading', 'Other'],
    'Professional Services': ['Consulting', 'Legal', 'Accounting', 'Architecture', 'Engineering', 'Design', 'Marketing', 'Other'],
    'Technology': ['Web Development', 'App Development', 'IT Support', 'Cybersecurity', 'Data Analysis', 'AI / ML', 'Cloud Infrastructure', 'Other'],
    'Other': ['Other'],
};

export const INDUSTRY_ICONS: Record<KnownIndustryVertical, string> = {
    'Home Services': 'home',
    'Commercial Construction': 'building',
    'Gig Work': 'briefcase',
    'Events & Entertainment': 'calendar',
    'Trade Labor': 'tool',
    'Day Labor': 'users',
    'Professional Services': 'award',
    'Technology': 'code',
    'Other': 'grid',
};

export type JobCategory = string;

export type ProjectUrgency = 'flexible' | 'within_month' | 'within_week' | 'urgent';

export interface Job {
    id: string;
    userId: string;
    title: string;
    category: JobCategory;
    description: string;
    location: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'DRAFT';
    createdAt: string;
    tags: string[];
    isPublic: boolean;
    requiresPermit: boolean;
    budget?: string;
    industryVertical: IndustryVertical;
    subcategory: string;
    urgency?: ProjectUrgency;
    squareFootage?: string;
    materials?: string;
    attachments?: string[];
    timelineStart?: string;
    timelineEnd?: string;
    communityProjectId?: string;
}

export interface Quote {
    id: string;
    jobId?: string;
    vendorId: string;
    vendorName: string;
    amount: number;
    estimatedDays: number;
    details: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    createdAt: string;
    phaseId?: string;
}

export interface Message {
    id: string;
    jobId: string;
    senderId: string;
    senderType: 'user' | 'vendor' | 'customer_agent' | 'vendor_agent' | 'system';
    content: string;
    timestamp: string;
    isAgentAction?: boolean;
}

export type AgentRole = 'customer' | 'vendor';

export type EscalationTrigger = 'quote_received' | 'scope_change' | 'budget_exceeded' | 'timeline_conflict' | 'manual_review';

export interface AgentConfig {
    id: string;
    userId: string;
    role: AgentRole;
    isActive: boolean;
    autoRespond: boolean;
    autoQuote: boolean;
    maxBudget?: number;
    minBudget?: number;
    industries: string[];
    specialties: string[];
    maxDistance?: number;
    baseRate?: number;
    communicationStyle: 'professional' | 'friendly' | 'concise';
    escalationTriggers: EscalationTrigger[];
    autoApproveBelow?: number;
    workingHoursOnly: boolean;
    serviceArea: string[];
    maxActiveJobs?: number;
    createdAt: string;
    updatedAt: string;
}

export type AgentActionType =
    | 'job_broadcast'
    | 'vendor_match'
    | 'auto_quote'
    | 'clarification_sent'
    | 'clarification_received'
    | 'scope_analysis'
    | 'quote_comparison'
    | 'escalation'
    | 'negotiation'
    | 'auto_approve'
    | 'auto_reject'
    | 'owner_instruction'
    | 'job_expired'
    | 'job_reminder'
    | 'vendor_rematch';

export interface PollRun {
    id: string;
    startedAt: string;
    finishedAt?: string;
    jobsScanned: number;
    jobsExpired: number;
    remindersSent: number;
    vendorRematches: number;
    errors: unknown[];
    triggeredBy: string;
}

export interface AgentInstruction {
    id: string;
    userId: string;
    instruction: string;
    acknowledged: boolean;
    createdAt: string;
}

export interface AgentAction {
    id: string;
    jobId: string | null;
    agentConfigId?: string;
    userId: string;
    actionType: AgentActionType;
    summary: string;
    details?: Record<string, unknown>;
    automated: boolean;
    createdAt: string;
}

export type PricingModel = 'hourly' | 'per_unit' | 'flat_fee' | 'tiered' | 'formula';

export interface EstimatingLineItem {
    name: string;
    description?: string;
    pricingModel: PricingModel;
    rate: number;
    unit?: string;
    materialMarkupPercent?: number;
    minimumCharge?: number;
    tiers?: { minQty: number; maxQty: number; rate: number }[];
    formula?: string;
}

export interface EstimatingTemplate {
    id: string;
    vendorProfileId: string;
    name: string;
    serviceCategory: string;
    industryVertical: IndustryVertical;
    lineItems: EstimatingLineItem[];
    laborRate: number;
    materialMarkupPercent: number;
    minimumCharge: number;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface VendorProfile {
    id: string;
    userId: string;
    companyName: string;
    companyDescription: string;
    contactEmail: string;
    contactPhone: string;
    website?: string;
    logoUrl?: string;
    serviceAreas: string[];
    industries: IndustryVertical[];
    specialties: string[];
    certifications: string[];
    insuranceDetails?: string;
    insuranceExpiry?: string;
    licenseNumber?: string;
    yearEstablished?: number;
    teamSize: number;
    portfolioImages: string[];
    portfolioDescriptions: string[];
    isVerified: boolean;
    avgRating?: number;
    totalReviews: number;
    createdAt: string;
    updatedAt: string;
}

export type TeamMemberRole = 'admin' | 'estimator' | 'field_worker';

export interface TeamMember {
    id: string;
    vendorProfileId: string;
    userId?: string;
    email: string;
    name: string;
    role: TeamMemberRole;
    isActive: boolean;
    invitedAt: string;
    acceptedAt?: string;
}

export interface VendorReview {
    id: string;
    vendorProfileId: string;
    reviewerId: string;
    reviewerName: string;
    jobId: string;
    rating: number;
    comment: string;
    createdAt: string;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type PhaseStatus = 'NOT_STARTED' | 'WAITING_QUOTES' | 'QUOTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface Project {
    id: string;
    userId: string;
    title: string;
    description: string;
    location: string;
    industryVertical: IndustryVertical;
    status: ProjectStatus;
    totalBudget?: number;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectPhase {
    id: string;
    projectId: string;
    name: string;
    description: string;
    tradeCategory: string;
    status: PhaseStatus;
    sortOrder: number;
    dependsOn: string[];
    startDate?: string;
    endDate?: string;
    estimatedCost?: number;
    actualCost?: number;
    acceptedQuoteId?: string;
    createdAt: string;
    updatedAt: string;
}

export type CommunityProjectStatus = 'ACTIVE' | 'FUNDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type CommunityProjectCategory =
    | 'Parks & Recreation'
    | 'Infrastructure'
    | 'Education'
    | 'Arts & Culture'
    | 'Environment'
    | 'Public Safety'
    | 'Community Spaces'
    | 'Open Source'
    | 'Other';

export const COMMUNITY_CATEGORIES: CommunityProjectCategory[] = [
    'Parks & Recreation',
    'Infrastructure',
    'Education',
    'Arts & Culture',
    'Environment',
    'Public Safety',
    'Community Spaces',
    'Open Source',
    'Other',
];

export interface CommunityProject {
    id: string;
    creatorId: string;
    creatorName: string;
    title: string;
    description: string;
    category: CommunityProjectCategory;
    location: string;
    goalAmount: number;
    currentFunding: number;
    status: CommunityProjectStatus;
    imageUrl?: string;
    contractAddress?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Donation {
    id: string;
    communityProjectId: string;
    donorId?: string;
    donorName: string;
    amount: number;
    isAnonymous: boolean;
    transactionHash?: string;
    message?: string;
    createdAt: string;
}

export interface CommunityProjectUpdate {
    id: string;
    communityProjectId: string;
    authorId: string;
    authorName: string;
    title: string;
    content: string;
    imageUrl?: string;
    createdAt: string;
}

export interface LedgerEntry {
    id: string;
    communityProjectId: string;
    type: 'DONATION' | 'EXPENSE';
    amount: number;
    description: string;
    referenceId?: string;
    transactionHash?: string;
    createdAt: string;
}

export type NotificationType =
    | 'quote_ready'
    | 'approval_needed'
    | 'scope_change'
    | 'agent_summary'
    | 'job_match'
    | 'negotiation_update'
    | 'milestone'
    | 'new_message'
    | 'verification_update'
    | 'job_reminder'
    | 'job_expired';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
    id: string;
    userId: string;
    jobId?: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    read: boolean;
    actionRequired: boolean;
    actionUrl?: string;
    createdAt: string;
}
