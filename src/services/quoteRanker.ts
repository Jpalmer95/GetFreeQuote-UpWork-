/**
 * Bid Desk Ranker & Report Builder
 *
 * Turns the normalized quote inbox into an apples-to-apples ranking and a CSV
 * the owner can act on. PURE LOGIC (no network) so it's unit-testable.
 *
 * Ranking: weighted score across price, estimated days, exclusions penalty,
 * license/COI verification, vendor rating (from vendor_reviews), and distance.
 * Lower score = better. Weights are injectable so the owner can tune them.
 *
 * See docs/plans/2026-08-13-hermes-agent-bid-desk.md (Phase 4).
 */

import type { RankedQuote } from '@/types';

export interface RankWeights {
    price: number;          // dollars (lower better)
    days: number;           // estimated_days (lower better)
    exclusionsPenalty: number; // +points per exclusion
    unverifiedPenalty: number; // +points if license or COI not verified
    rating: number;         // rating out of 5 (higher better)
    distance: number;       // miles (lower better)
}

export const DEFAULT_RANK_WEIGHTS: RankWeights = {
    price: 1.0,
    days: 3.0,
    exclusionsPenalty: 40,
    unverifiedPenalty: 60,
    rating: -20,            // subtract: higher rating improves score
    distance: 0.5,
};

export interface RankedRow {
    threadId: string;
    vendor?: string | null;
    channel?: string | null;
    amount: number;
    days?: number | null;
    startAvailability?: string | null;
    exclusions?: string | null;
    licenseVerified: boolean;
    coiVerified: boolean;
    rating?: number | null;
    distanceMi?: number | null;
    rawScore: number;
    rank: number;
    notes?: string | null;
}

/** Compute the weighted score for a single quote. Lower is better. */
export function computeQuoteScore(q: RankedQuote, w: RankWeights = DEFAULT_RANK_WEIGHTS): number {
    const exclusions = (q.exclusions || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    const unverified = (!q.license_verified || !q.coi_verified) ? 1 : 0;

    return (
        (q.quote_amount || 0) * w.price +
        (q.estimated_days || 0) * w.days +
        exclusions.length * w.exclusionsPenalty +
        unverified * w.unverifiedPenalty +
        (q.rating || 0) * w.rating +
        (q.distance_mi || 0) * w.distance
    );
}

/** Rank a set of quotes, lowest score first. Ties broken by amount, then rating. */
export function rankQuotes(
    quotes: RankedQuote[],
    weights: RankWeights = DEFAULT_RANK_WEIGHTS
): RankedRow[] {
    const scored = quotes.map(q => ({
        threadId: q.thread_id,
        amount: q.quote_amount,
        days: q.estimated_days,
        startAvailability: q.start_availability,
        exclusions: q.exclusions,
        licenseVerified: q.license_verified,
        coiVerified: q.coi_verified,
        rating: q.rating,
        distanceMi: q.distance_mi,
        notes: q.notes,
        rawScore: computeQuoteScore(q, weights),
    }));

    scored.sort((a, b) => {
        if (a.rawScore !== b.rawScore) return a.rawScore - b.rawScore;
        if (a.amount !== b.amount) return a.amount - b.amount;
        return (b.rating || 0) - (a.rating || 0);
    });

    return scored.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** CSV-escape a value per RFC 4180. */
function csvEscape(v: unknown): string {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** Build a CSV string from ranked rows. */
export function buildQuotesCsv(rows: RankedRow[]): string {
    const header = [
        'rank', 'amount', 'estimated_days', 'start_availability', 'exclusions',
        'license_verified', 'coi_verified', 'rating', 'distance_mi', 'raw_score', 'notes',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
        lines.push([
            r.rank, r.amount, r.days, r.startAvailability, r.exclusions,
            r.licenseVerified, r.coiVerified, r.rating, r.distanceMi,
            Math.round(r.rawScore * 100) / 100, r.notes,
        ].map(csvEscape).join(','));
    }
    return lines.join('\n');
}

/** Human-readable summary of the top N. */
export function summarizeTop(rows: RankedRow[], n: number): string {
    return rows.slice(0, n).map(r =>
        `#${r.rank} — $${r.amount.toLocaleString()} (${r.days ?? '?'}d)` +
        `${r.licenseVerified && r.coiVerified ? ' · verified' : ''}` +
        `${r.rating ? ` · ${r.rating}★` : ''}` +
        `${r.startAvailability ? ` · starts ${r.startAvailability}` : ''}`
    ).join('\n');
}
