export type UserRole = 'USER' | 'VENDOR' | 'ADMIN';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}

export type IndustryVertical =
    | 'Home Services'
    | 'Commercial Construction'
    | 'Gig Work'
    | 'Events & Entertainment'
    | 'Trade Labor'
    | 'Day Labor'
    | 'Professional Services'
    | 'Technology'
    | 'Other';

export const INDUSTRY_VERTICALS: IndustryVertical[] = [
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

export const INDUSTRY_SUBCATEGORIES: Record<IndustryVertical, string[]> = {
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

export const INDUSTRY_ICONS: Record<IndustryVertical, string> = {
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
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
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
}

export interface Quote {
    id: string;
    jobId: string;
    vendorId: string;
    vendorName: string;
    amount: number;
    estimatedDays: number;
    details: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    createdAt: string;
}

export interface Message {
    id: string;
    jobId: string;
    senderId: string;
    content: string;
    timestamp: string;
    isAgentAction?: boolean;
}
