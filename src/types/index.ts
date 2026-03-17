export type UserRole = 'USER' | 'VENDOR' | 'ADMIN';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
}

export type JobCategory = 'Plumbing' | 'Electrical' | 'HVAC' | 'Construction' | 'Cleaning' | 'Web Design' | 'Other';

export interface Job {
    id: string;
    userId: string;
    title: string;
    category: JobCategory;
    description: string;
    location: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    createdAt: string;
    tags: string[]; // e.g. "Plumbing", "Electrical"
    isPublic: boolean;
    requiresPermit: boolean;
    budget?: string; // Optional to avoid bias
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
    senderId: string; // "SYSTEM", "AGENT", or UserID
    content: string;
    timestamp: string;
    isAgentAction?: boolean; // If true, this is the AI Agent doing something
}
