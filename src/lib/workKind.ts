export type WorkKind = 'quote' | 'bounty' | 'local';

export const WORK_KINDS: WorkKind[] = ['quote', 'bounty', 'local'];

const KIND_PREFIX = 'kind:';

export function isWorkKind(value: unknown): value is WorkKind {
    return value === 'quote' || value === 'bounty' || value === 'local';
}

export function workKindFromTags(
    tags: string[] | null | undefined,
    isLocal?: boolean | null,
): WorkKind {
    const list = tags || [];
    if (list.includes(`${KIND_PREFIX}bounty`)) return 'bounty';
    if (list.includes(`${KIND_PREFIX}local`) || isLocal) return 'local';
    return 'quote';
}

export function withWorkKindTags(tags: string[] | null | undefined, kind: WorkKind): string[] {
    const rest = (tags || []).filter((t) => !t.startsWith(KIND_PREFIX));
    return [...rest, `${KIND_PREFIX}${kind}`];
}

/** First dollar-like number in a budget string ("$500 - $800" → 500). */
export function parseBudgetAmount(budget?: string | null): number | null {
    if (!budget) return null;
    const match = budget.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
    quote: 'Get quotes',
    bounty: 'Fixed bounty',
    local: 'Nearby / same-day',
};

export const WORK_KIND_HINT: Record<WorkKind, string> = {
    quote: 'Vendors compete. You pick the best bid.',
    bounty: 'Set one price. Someone (or their agent) claims it and delivers.',
    local: 'In-person help near you — popped tire, extra hands, same-day labor.',
};
