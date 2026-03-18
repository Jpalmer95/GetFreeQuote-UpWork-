import { TeamMemberRole } from '@/types';

export type VendorRole = 'owner' | TeamMemberRole;

const ROLE_PERMISSIONS: Record<VendorRole, Set<string>> = {
    owner: new Set(['profile.edit', 'profile.view', 'estimating.create', 'estimating.edit', 'estimating.delete', 'estimating.view', 'team.manage', 'team.view', 'quotes.create', 'quotes.view']),
    admin: new Set(['profile.edit', 'profile.view', 'estimating.create', 'estimating.edit', 'estimating.delete', 'estimating.view', 'team.view', 'quotes.create', 'quotes.view']),
    estimator: new Set(['profile.view', 'estimating.create', 'estimating.edit', 'estimating.view', 'quotes.create', 'quotes.view']),
    field_worker: new Set(['profile.view', 'quotes.view']),
};

export function hasPermission(role: VendorRole, permission: string): boolean {
    return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getRoleLabel(role: VendorRole): string {
    switch (role) {
        case 'owner': return 'Owner';
        case 'admin': return 'Admin';
        case 'estimator': return 'Estimator';
        case 'field_worker': return 'Field Worker';
        default: return role;
    }
}
