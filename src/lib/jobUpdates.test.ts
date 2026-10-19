import { describe, it, expect } from 'vitest';
import { jobPatchFromBody, canCancelJobStatus } from './jobUpdates';

describe('jobPatchFromBody', () => {
    it('maps allowlisted camelCase fields and ignores unknown keys', () => {
        const patch = jobPatchFromBody({
            title: '  New roof  ',
            userId: 'attacker',
            status: 'COMPLETED',
            owner_id: 'nope',
            isPublic: false,
            lat: 30.4,
        });
        expect(patch).toEqual({
            title: 'New roof',
            is_public: false,
            location_lat: 30.4,
        });
        expect(patch).not.toHaveProperty('user_id');
        expect(patch).not.toHaveProperty('status');
        expect(patch).not.toHaveProperty('owner_id');
    });

    it('rewrites kind tags when workKind is set', () => {
        const patch = jobPatchFromBody({
            workKind: 'bounty',
            tags: ['plumbing', 'kind:quote'],
        });
        expect(patch.tags).toEqual(['plumbing', 'kind:bounty']);
    });

    it('sets local request when kind is local', () => {
        const patch = jobPatchFromBody({ workKind: 'local' });
        expect(patch.is_local_request).toBe(true);
        expect(patch.tags).toEqual(['kind:local']);
    });
});

describe('canCancelJobStatus', () => {
    it('allows open/draft/expired only', () => {
        expect(canCancelJobStatus('OPEN')).toBe(true);
        expect(canCancelJobStatus('IN_PROGRESS')).toBe(false);
        expect(canCancelJobStatus('COMPLETED')).toBe(false);
    });
});
