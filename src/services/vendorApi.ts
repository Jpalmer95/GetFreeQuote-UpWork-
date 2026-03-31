import { supabase } from '@/lib/supabase';
import { VendorProfile, EstimatingTemplate, TeamMember, IndustryVertical, EstimatingLineItem } from '@/types';
import { VendorRole } from './vendorAuth';

async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
    };
}

async function vendorGet(action: string): Promise<Record<string, unknown>> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/vendor?action=${action}`, { headers });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return res.json();
}

async function vendorPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/vendor', { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

export const vendorApi = {
    getContext: async (): Promise<{ profile: VendorProfile; role: VendorRole } | null> => {
        const data = await vendorGet('context');
        return (data.context as { profile: VendorProfile; role: VendorRole }) || null;
    },

    upsertProfile: async (profile: {
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
        locationLat?: number;
        locationLng?: number;
    }): Promise<VendorProfile> => {
        const data = await vendorPost({ action: 'upsert-profile', ...profile });
        return data.profile as VendorProfile;
    },

    getTemplates: async (): Promise<{ templates: EstimatingTemplate[]; role: VendorRole }> => {
        const data = await vendorGet('templates');
        return {
            templates: (data.templates as EstimatingTemplate[]) || [],
            role: (data.role as VendorRole) || 'owner',
        };
    },

    createTemplate: async (template: {
        name: string;
        serviceCategory: string;
        industryVertical: string;
        laborRate: number;
        materialMarkupPercent: number;
        minimumCharge: number;
        isDefault: boolean;
        lineItems: EstimatingLineItem[];
    }): Promise<EstimatingTemplate> => {
        const data = await vendorPost({ action: 'create-template', ...template });
        return data.template as EstimatingTemplate;
    },

    updateTemplate: async (templateId: string, template: {
        name: string;
        serviceCategory: string;
        industryVertical: string;
        laborRate: number;
        materialMarkupPercent: number;
        minimumCharge: number;
        isDefault: boolean;
        lineItems: EstimatingLineItem[];
    }): Promise<EstimatingTemplate> => {
        const data = await vendorPost({ action: 'update-template', templateId, ...template });
        return data.template as EstimatingTemplate;
    },

    deleteTemplate: async (templateId: string): Promise<void> => {
        await vendorPost({ action: 'delete-template', templateId });
    },

    getTeam: async (): Promise<{ members: TeamMember[]; role: VendorRole }> => {
        const data = await vendorGet('team');
        return {
            members: (data.members as TeamMember[]) || [],
            role: (data.role as VendorRole) || 'owner',
        };
    },

    addTeamMember: async (member: { email: string; name: string; role: string }): Promise<TeamMember> => {
        const data = await vendorPost({ action: 'add-team-member', ...member });
        return data.member as TeamMember;
    },

    updateTeamMember: async (memberId: string, updates: { name?: string; role?: string; isActive?: boolean }): Promise<TeamMember> => {
        const data = await vendorPost({ action: 'update-team-member', memberId, ...updates });
        return data.member as TeamMember;
    },

    removeTeamMember: async (memberId: string): Promise<void> => {
        await vendorPost({ action: 'remove-team-member', memberId });
    },

    getPendingInvitations: async (): Promise<{ id: string; companyName: string; role: string; invitedAt: string }[]> => {
        const data = await vendorGet('pending-invitations');
        return (data.invitations as { id: string; companyName: string; role: string; invitedAt: string }[]) || [];
    },

    acceptInvitation: async (memberId: string): Promise<TeamMember> => {
        const data = await vendorPost({ action: 'accept-invitation', memberId });
        return data.member as TeamMember;
    },
};
