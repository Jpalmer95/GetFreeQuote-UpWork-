import { isWorkKind, withWorkKindTags, type WorkKind } from '@/lib/workKind';

/** camelCase body keys → snake_case columns. Never spread the client body. */
export const JOB_PATCH_MAP = {
    title: 'title',
    description: 'description',
    location: 'location',
    category: 'category',
    budget: 'budget',
    industryVertical: 'industry_vertical',
    subcategory: 'subcategory',
    urgency: 'urgency',
    squareFootage: 'square_footage',
    materials: 'materials',
    isPublic: 'is_public',
    requiresPermit: 'requires_permit',
    isLocalRequest: 'is_local_request',
    lat: 'location_lat',
    lng: 'location_lng',
    radiusMiles: 'radius_miles',
    timelineStart: 'timeline_start',
    timelineEnd: 'timeline_end',
} as const;

type PatchKey = keyof typeof JOB_PATCH_MAP;

const STRING_KEYS = new Set<PatchKey>([
    'title', 'description', 'location', 'category', 'budget',
    'industryVertical', 'subcategory', 'urgency', 'squareFootage', 'materials',
    'timelineStart', 'timelineEnd',
]);

const BOOL_KEYS = new Set<PatchKey>(['isPublic', 'requiresPermit', 'isLocalRequest']);
const NUMBER_KEYS = new Set<PatchKey>(['lat', 'lng', 'radiusMiles']);

export function jobPatchFromBody(body: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(JOB_PATCH_MAP) as PatchKey[]) {
        if (!(key in body) || body[key] === undefined) continue;
        const column = JOB_PATCH_MAP[key];
        const value = body[key];

        if (STRING_KEYS.has(key)) {
            if (value === null) {
                out[column] = null;
            } else if (typeof value === 'string') {
                const trimmed = value.trim();
                out[column] = trimmed.length === 0 ? null : trimmed;
            }
            continue;
        }

        if (BOOL_KEYS.has(key)) {
            out[column] = Boolean(value);
            continue;
        }

        if (NUMBER_KEYS.has(key)) {
            if (value === null || value === '') {
                out[column] = null;
            } else {
                const n = Number(value);
                if (Number.isFinite(n)) out[column] = n;
            }
        }
    }

    if (Array.isArray(body.attachments)) {
        out.attachments = body.attachments.filter((u): u is string => typeof u === 'string');
    }

    let tags: string[] | undefined;
    if (Array.isArray(body.tags)) {
        tags = body.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    }

    const kind: WorkKind | undefined = isWorkKind(body.workKind)
        ? body.workKind
        : undefined;

    if (kind) {
        tags = withWorkKindTags(tags ?? [], kind);
        if (kind === 'local') out.is_local_request = true;
    } else if (tags) {
        out.tags = tags;
    }

    if (kind) out.tags = tags;

    return out;
}

export function canCancelJobStatus(status: string): boolean {
    return status === 'OPEN' || status === 'DRAFT' || status === 'EXPIRED';
}
