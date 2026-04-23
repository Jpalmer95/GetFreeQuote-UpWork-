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
    'Gig Work': ['Delivery', 'Moving & Hauling', 'Assembly', 'Personal Shopping', 'Pet Care', 'Tutoring', 'Photography', 'Videography', 'Food & Beverage Coverage', 'Roadside Assistance', 'Same-Day Labor', 'Grocery/Errand Run', 'Event Staff', 'Other'],
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
    isLocalRequest?: boolean;
    locationLat?: number;
    locationLng?: number;
    radiusMiles?: number;
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
    locationLat?: number;
    locationLng?: number;
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
    locationLat?: number;
    locationLng?: number;
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

// ============================================================
// STRUCTURED QUOTE BREAKDOWNS
// ============================================================

export type QuoteLineItemType = 'materials' | 'labor' | 'permits' | 'equipment' | 'overhead' | 'add_on' | 'discount' | 'other';

export interface QuoteLineItem {
    id: string;
    type: QuoteLineItemType;
    name: string;
    description?: string;
    quantity: number;
    unit: string;           // 'sqft', 'hours', 'each', 'linear_ft', etc.
    unitPrice: number;
    totalPrice: number;
    isOptional: boolean;    // true = add-on the user can accept/decline
    materialGrade?: string; // 'builder', 'standard', 'premium'
    laborHours?: number;
    laborRate?: number;
}

export interface QuoteMilestone {
    id: string;
    name: string;           // 'Demo complete', 'Rough-in done', etc.
    description?: string;
    percentageOfTotal: number; // 0-100, sum must = 100
    estimatedDays: number;
    releaseOnCompletion: boolean; // release escrow at this milestone
}

export interface StructuredQuote {
    id: string;
    quoteId: string;        // links to parent Quote
    lineItems: QuoteLineItem[];
    milestones: QuoteMilestone[];
    materialsSubtotal: number;
    laborSubtotal: number;
    permitsSubtotal: number;
    equipmentSubtotal: number;
    overheadSubtotal: number;
    optionalAddOns: number;
    discounts: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    paymentTerms: PaymentTerms;
    warrantyDescription?: string;
    warrantyDurationMonths?: number;
    createdAt: string;
    updatedAt: string;
}

export type PaymentScheduleType = 'upfront' | 'fifty_fifty' | 'milestone' | 'net_30' | 'custom';

export interface PaymentTerms {
    schedule: PaymentScheduleType;
    depositPercent?: number;
    customSchedule?: { percent: number; dueAt: string }[];
    lateFeePercent?: number;
    earlyPayDiscount?: number;
}

// ============================================================
// TRUST SCORE SYSTEM
// ============================================================

export interface TrustScoreBreakdown {
    vendorId: string;
    overallScore: number;          // 0-100
    licenseVerified: boolean;
    licenseScore: number;          // 0-25
    insuranceVerified: boolean;
    insuranceScore: number;        // 0-20
    insuranceExpiry?: string;
    bondVerified: boolean;
    reviewScore: number;           // 0-20 (decay-weighted)
    reviewCount: number;
    reviewWeightedAvg: number;
    completionRate: number;        // 0-15 (percentage mapped to score)
    completedJobs: number;
    cancelledJobs: number;
    responseTimeScore: number;     // 0-10
    avgResponseMinutes: number;
    disputeScore: number;          // 0-10
    disputesTotal: number;
    disputesResolved: number;
    fairPricerBadge: boolean;      // consistently bids within market range
    topRatedBadge: boolean;        // top 10% in category
    veteranBadge: boolean;         // 3+ years on platform
    fastResponderBadge: boolean;   // avg response < 1 hour
    calculatedAt: string;
}

export interface VendorReviewEnhanced extends VendorReview {
    jobTotalAmount?: number;       // weight larger jobs more
    verified: boolean;             // confirmed job completion
    helpfulVotes: number;
    unhelpfulVotes: number;
    vendorResponse?: string;
    vendorResponseAt?: string;
    category: string;              // what type of work
    subcategory: string;
}

// ============================================================
// LEAD QUALITY SCORING
// ============================================================

export interface LeadQualityScore {
    jobId: string;
    overallScore: number;          // 0-100
    descriptionScore: number;      // 0-25 (completeness, detail)
    hasPhotos: boolean;
    hasDimensions: boolean;
    hasBudget: boolean;
    budgetRealism: number;         // 0-20 (is budget realistic for category?)
    budgetRangeLow?: number;
    budgetRangeHigh?: number;
    userScore: number;             // 0-20 (user history)
    isReturningUser: boolean;
    userResponseRate: number;      // 0-1 (historical)
    userAvgRating: number;         // how vendors rate this user
    urgencyScore: number;          // 0-15
    locationScore: number;         // 0-10 (vendor density in area)
    competingQuotes: number;
    estimatedCloseTime?: string;   // "likely to hire within 3 days"
    calculatedAt: string;
}

// ============================================================
// ESCROW & PAYMENT PROTECTION
// ============================================================

export type EscrowStatus = 'pending' | 'funded' | 'partial_released' | 'released' | 'disputed' | 'refunded' | 'expired';

export interface EscrowAccount {
    id: string;
    jobId: string;
    quoteId: string;
    payerId: string;           // user who pays
    payeeId: string;           // vendor who gets paid
    totalAmount: number;
    fundedAmount: number;
    releasedAmount: number;
    status: EscrowStatus;
    milestones: EscrowMilestone[];
    createdAt: string;
    fundedAt?: string;
    completedAt?: string;
    disputeId?: string;
}

export interface EscrowMilestone {
    id: string;
    escrowAccountId: string;
    name: string;
    amount: number;
    status: 'pending' | 'submitted' | 'approved' | 'released' | 'disputed';
    proofPhotos?: string[];
    proofDescription?: string;
    submittedAt?: string;
    approvedAt?: string;
    releasedAt?: string;
    approvedBy?: string;       // user who approved
}

export interface Dispute {
    id: string;
    escrowAccountId: string;
    jobId: string;
    filedBy: string;           // userId
    filedAgainst: string;      // userId
    reason: string;
    description: string;
    evidencePhotos: string[];
    status: 'open' | 'under_review' | 'resolved' | 'escalated';
    resolution?: string;
    resolutionAmount?: number;
    resolvedAt?: string;
    resolvedBy?: string;
    createdAt: string;
}

export type PaymentProvider = 'stripe' | 'platform_escrow' | 'smart_contract';

export interface PaymentRecord {
    id: string;
    jobId: string;
    escrowAccountId?: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    fee: number;
    netAmount: number;
    provider: PaymentProvider;
    providerTransactionId?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
    type: 'deposit' | 'milestone_release' | 'final_payment' | 'refund' | 'factoring_advance';
    createdAt: string;
    completedAt?: string;
}

// ============================================================
// GPS TRACKING & LIVE LOCATION (Go Local)
// ============================================================

export interface GPSTrackingSession {
    id: string;
    jobId: string;
    vendorId: string;
    status: 'en_route' | 'arrived' | 'working' | 'completed' | 'cancelled';
    startedAt: string;
    estimatedArrival?: string;
    arrivedAt?: string;
    completedAt?: string;
    currentLat?: number;
    currentLng?: number;
    routeHistory: GPSPoint[];
    completionPhotos: string[];
}

export interface GPSPoint {
    lat: number;
    lng: number;
    timestamp: string;
    accuracy?: number;
}

// ============================================================
// SURGE PRICING ENGINE
// ============================================================

export type SurgeCategory = 'gig_work' | 'emergency' | 'moving' | 'delivery' | 'labor';

export interface SurgeState {
    category: SurgeCategory;
    geoHash: string;           // geohash of the area
    currentMultiplier: number; // 1.0 = normal, 1.5 = 50% surge
    demandCount: number;       // active jobs in area
    supplyCount: number;       // available vendors in area
    demandSupplyRatio: number;
    level: 'normal' | 'moderate' | 'high' | 'extreme';
    updatedAt: string;
    expiresAt?: string;        // surge is time-limited
}

export interface SurgeHistory {
    category: SurgeCategory;
    geoHash: string;
    multiplier: number;
    timestamp: string;
    demandCount: number;
    supplyCount: number;
}

// ============================================================
// MATERIAL GROUP BUYING
// ============================================================

export interface MaterialGroupBuy {
    id: string;
    organizerId: string;       // vendor who started it
    materialCategory: string;  // 'drywall', 'lumber', 'concrete', etc.
    materialDescription: string;
    supplierName?: string;
    supplierContact?: string;
    retailPricePerUnit: number;
    groupPricePerUnit: number;
    minimumQuantity: number;
    currentQuantity: number;
    targetQuantity: number;
    savingsPercent: number;
    participants: GroupBuyParticipant[];
    status: 'gathering' | 'confirmed' | 'ordered' | 'delivered' | 'cancelled';
    deadline: string;
    deliveryDate?: string;
    deliveryLocation?: string;
    createdAt: string;
}

export interface GroupBuyParticipant {
    vendorId: string;
    vendorName: string;
    quantity: number;
    totalPrice: number;
    joinedAt: string;
    paid: boolean;
}

// ============================================================
// APPRENTICE & MENTORSHIP
// ============================================================

export type ApprenticeStatus = 'seeking' | 'matched' | 'active' | 'completed' | 'cancelled';

export interface ApprenticeProfile {
    id: string;
    userId: string;
    name: string;
    desiredTrade: string;
    experienceLevel: 'none' | 'some' | 'formal_training';
    certifications: string[];
    availability: 'full_time' | 'part_time' | 'weekends';
    locationLat: number;
    locationLng: number;
    maxCommuteMiles: number;
    status: ApprenticeStatus;
    hoursLogged: number;
    hoursRequired?: number;    // for certification
    currentMentorId?: string;
    bio: string;
    createdAt: string;
}

export interface MentorProfile {
    vendorId: string;
    vendorName: string;
    tradesOffered: string[];
    maxApprentices: number;
    currentApprentices: number;
    hourlyRateForApprentice: number; // discounted rate
    yearsExperience: number;
    certifiedToTeach: boolean;
    bio: string;
}

export interface ApprenticeLog {
    id: string;
    apprenticeId: string;
    mentorId: string;
    jobId?: string;
    date: string;
    hoursWorked: number;
    skillsPracticed: string[];
    mentorNotes?: string;
    apprenticeNotes?: string;
    photos: string[];
}

// ============================================================
// VENDOR PERFORMANCE ANALYTICS
// ============================================================

export interface VendorAnalytics {
    vendorId: string;
    period: 'week' | 'month' | 'quarter' | 'year' | 'all_time';
    periodStart: string;
    periodEnd: string;
    jobsCompleted: number;
    jobsWon: number;
    jobsBid: number;
    winRate: number;           // jobsWon / jobsBid
    avgBidAmount: number;
    avgMarketRate: number;     // for same category/area
    bidVsMarketRatio: number;  // 1.0 = at market, 0.9 = 10% below
    avgResponseTimeMinutes: number;
    responseTimePercentile: number; // vs area competitors
    avgRating: number;
    ratingTrend: 'improving' | 'stable' | 'declining';
    revenueTotal: number;
    revenuePerJob: number;
    repeatCustomerRate: number;
    totalCustomers: number;
    topCategories: { category: string; count: number; winRate: number }[];
    customerSatisfactionScore: number;
    onTimeCompletionRate: number;
    disputeRate: number;
}

export interface AreaBenchmark {
    category: string;
    subcategory?: string;
    area: string;              // city or zip
    avgBidAmount: number;
    medianBidAmount: number;
    avgRating: number;
    avgResponseTimeMinutes: number;
    vendorCount: number;
    jobsPerMonth: number;
    calculatedAt: string;
}

// ============================================================
// NEIGHBORHOOD POOL BUILDS
// ============================================================

export interface NeighborhoodPool {
    id: string;
    title: string;
    description: string;
    workType: string;          // 'fence replacement', 'solar install', etc.
    location: string;
    locationLat: number;
    locationLng: number;
    radiusMiles: number;
    organizerId: string;
    minParticipants: number;
    maxParticipants: number;
    currentParticipants: PoolParticipant[];
    estimatedIndividualCost: number;  // what one person would pay alone
    estimatedPoolCost: number;        // bulk pricing per participant
    savingsPercent: number;
    status: 'gathering' | 'funded' | 'contractor_selected' | 'in_progress' | 'completed';
    selectedVendorId?: string;
    selectedQuoteId?: string;
    deadline: string;
    createdAt: string;
}

export interface PoolParticipant {
    userId: string;
    userName: string;
    address: string;
    addressLat: number;
    addressLng: number;
    agreedAmount: number;
    paid: boolean;
    joinedAt: string;
    specialRequests?: string;
}

// ============================================================
// VOLUNTEER HOURS & COMMUNITY CREDITS
// ============================================================

export interface VolunteerLog {
    id: string;
    userId: string;
    communityProjectId: string;
    hoursWorked: number;
    role: string;              // 'general labor', 'skilled trade', 'coordination'
    date: string;
    verifiedBy?: string;       // project organizer verifies
    creditsEarned: number;     // 1 credit per hour * multiplier
    notes?: string;
}

export interface CommunityCredits {
    userId: string;
    totalEarned: number;
    totalSpent: number;
    currentBalance: number;
    history: CreditTransaction[];
}

export interface CreditTransaction {
    id: string;
    userId: string;
    amount: number;            // positive = earned, negative = spent
    type: 'volunteer_earned' | 'referral_bonus' | 'project_discount' | 'expired';
    description: string;
    relatedProjectId?: string;
    relatedJobId?: string;
    createdAt: string;
}

// ============================================================
// NEIGHBORHOOD / COMMUNITY IMPACT
// ============================================================

export interface ImpactMetrics {
    communityProjectId: string;
    residentsBenefited: number;
    squareFeetImproved: number;
    jobsCreated: number;
    volunteerHoursTotal: number;
    totalInvested: number;
    privateDonations: number;
    volunteerValue: number;    // hours * avg hourly rate
    beforePhotos: string[];
    afterPhotos: string[];
    completionPercent: number;
    lastUpdated: string;
}

// ============================================================
// MARKETPLACE TIERS & SUBSCRIPTIONS
// ============================================================

export type VendorTier = 'free' | 'pro' | 'elite';

export interface VendorSubscription {
    vendorId: string;
    tier: VendorTier;
    bidsPerMonth: number;
    bidsUsedThisMonth: number;
    features: VendorTierFeatures;
    startDate: string;
    renewalDate: string;
    status: 'active' | 'past_due' | 'cancelled';
    monthlyPrice: number;
}

export interface VendorTierFeatures {
    unlimitedBids: boolean;
    priorityMatching: boolean;
    analyticsDashboard: boolean;
    leadQualityScores: boolean;
    bulkBidding: boolean;
    materialGroupBuying: boolean;
    apiAccess: boolean;
    featuredPlacement: boolean;
    badge: string | null;      // 'Pro', 'Elite', null for free
}

export const VENDOR_TIER_CONFIG: Record<VendorTier, VendorTierFeatures> = {
    free: {
        unlimitedBids: false, priorityMatching: false, analyticsDashboard: false,
        leadQualityScores: false, bulkBidding: false, materialGroupBuying: false,
        apiAccess: false, featuredPlacement: false, badge: null,
    },
    pro: {
        unlimitedBids: true, priorityMatching: true, analyticsDashboard: true,
        leadQualityScores: true, bulkBidding: false, materialGroupBuying: true,
        apiAccess: false, featuredPlacement: false, badge: 'Pro',
    },
    elite: {
        unlimitedBids: true, priorityMatching: true, analyticsDashboard: true,
        leadQualityScores: true, bulkBidding: true, materialGroupBuying: true,
        apiAccess: true, featuredPlacement: true, badge: 'Elite',
    },
};

// ============================================================
// INVOICE FACTORING / EARLY PAYMENT
// ============================================================

export interface FactoringRequest {
    id: string;
    vendorId: string;
    jobId: string;
    escrowAccountId: string;
    originalAmount: number;
    advanceAmount: number;     // amount vendor gets now
    feeAmount: number;         // platform fee for early payment
    feePercent: number;
    status: 'requested' | 'approved' | 'funded' | 'repaid' | 'denied';
    requestedAt: string;
    fundedAt?: string;
    repaidAt?: string;
}

// ============================================================
// EMERGENCY RESPONSE (Go Local)
// ============================================================

export type EmergencyCategory = 'plumbing' | 'electrical' | 'hvac' | 'lockout' | 'tree_removal' | 'water_damage' | 'other';

export interface EmergencyRequest {
    id: string;
    jobId: string;
    category: EmergencyCategory;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    photos: string[];
    locationLat: number;
    locationLng: number;
    radiusMiles: number;
    maxResponseMinutes: number;  // user expects response within X min
    surgeMultiplier: number;     // emergency premium
    notifiedVendorIds: string[];
    acceptedVendorId?: string;
    estimatedArrival?: string;
    status: 'broadcasting' | 'accepted' | 'en_route' | 'on_site' | 'resolved' | 'expired';
    createdAt: string;
    resolvedAt?: string;
}

// ============================================================
// MULTI-GIG BUNDLING
// ============================================================

export interface GigBundle {
    id: string;
    userId: string;
    title: string;
    jobs: string[];              // job IDs
    totalEstimatedValue: number;
    bundleDiscount: number;      // percentage
    discountedTotal: number;
    locationLat: number;
    locationLng: number;
    preferredVendorId?: string;
    status: 'open' | 'claimed' | 'in_progress' | 'completed';
    createdAt: string;
}

// ============================================================
// AI PRICE ESTIMATION
// ============================================================

export interface PriceEstimate {
    category: string;
    subcategory: string;
    description: string;
    location: string;
    lowEstimate: number;
    highEstimate: number;
    medianEstimate: number;
    confidence: number;        // 0-1
    dataPoints: number;        // how many past jobs informed this
    breakdown: {
        materialsLow: number;
        materialsHigh: number;
        laborLow: number;
        laborHigh: number;
        permitsLow: number;
        permitsHigh: number;
    };
    factors: string[];         // ['seasonal_demand: high', 'area_pricing: above_national_avg']
    generatedAt: string;
}

// ============================================================
// SCOPE BREAKDOWN AI
// ============================================================

export interface ScopeBreakdown {
    id: string;
    jobId: string;
    phases: ScopePhase[];
    totalEstimateLow: number;
    totalEstimateHigh: number;
    suggestedContractors: number;  // how many vendors needed
    canPhaseBid: boolean;          // vendors can bid per-phase
    generatedAt: string;
    confidence: number;
}

export interface ScopePhase {
    id: string;
    name: string;
    description: string;
    orderIndex: number;
    tradeRequired: string;     // 'plumbing', 'electrical', etc.
    estimateLow: number;
    estimateHigh: number;
    durationDays: number;
    dependsOn: string[];       // other phase IDs
    permitRequired: boolean;
    materialsNeeded: string[];
}

// ============================================================
// ENHANCED MATCHING (extends existing vendorMatcher)
// ============================================================

export interface EnhancedVendorMatch {
    config: AgentConfig;
    score: number;
    reasons: string[];
    trustScore?: TrustScoreBreakdown;
    bidPrediction?: {
        predictedBidLow: number;
        predictedBidHigh: number;
        confidence: number;
    };
    availability?: {
        nextAvailable: string;
        estimatedDays: number;
    };
    competitiveEdge?: string[];  // 'fastest_response', 'best_rated', 'lowest_price', 'most_experience'
}
