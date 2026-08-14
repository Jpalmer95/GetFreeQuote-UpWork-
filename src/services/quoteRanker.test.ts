import { computeQuoteScore, rankQuotes, buildQuotesCsv, summarizeTop, DEFAULT_RANK_WEIGHTS } from '@/services/quoteRanker';
import type { RankedQuote } from '@/types';

const base = (overrides: Partial<RankedQuote>): RankedQuote => ({
    id: 'q',
    thread_id: 't',
    quote_amount: 1000,
    estimated_days: 5,
    start_availability: '2026-09-01',
    exclusions: null,
    license_verified: true,
    coi_verified: true,
    rating: 4.5,
    distance_mi: 10,
    rank: null,
    notes: null,
    created_at: '2026-08-13T00:00:00Z',
    ...overrides,
});

describe('computeQuoteScore', () => {
    it('a verified, no-exclusion quote scores lower (better) than an unverified one', () => {
        const good = computeQuoteScore(base({ quote_amount: 2000 }));
        const bad = computeQuoteScore(base({ quote_amount: 2000, license_verified: false, coi_verified: false }));
        expect(good).toBeLessThan(bad);
    });

    it('adds penalty per exclusion', () => {
        const none = computeQuoteScore(base({ exclusions: null }));
        const one = computeQuoteScore(base({ exclusions: 'No permit' }));
        expect(one - none).toBe(DEFAULT_RANK_WEIGHTS.exclusionsPenalty);
    });

    it('higher price increases score (with positive price weight)', () => {
        const cheap = computeQuoteScore(base({ quote_amount: 1000 }));
        const pricey = computeQuoteScore(base({ quote_amount: 5000 }));
        expect(cheap).toBeLessThan(pricey);
    });
});

describe('rankQuotes', () => {
    it('ranks lower price first when other factors equal', () => {
        const rows = rankQuotes([
            base({ thread_id: 'a', quote_amount: 3000 }),
            base({ thread_id: 'b', quote_amount: 1500 }),
        ]);
        expect(rows[0].threadId).toBe('b');
        expect(rows[1].threadId).toBe('a');
    });

    it('an unverified cheap quote loses to a slightly pricier verified one', () => {
        // unverified penalty = +60; a $40 price advantage is NOT enough to overcome it
        const rows = rankQuotes([
            base({ thread_id: 'cheap-unverified', quote_amount: 1000, license_verified: false, coi_verified: false }),
            base({ thread_id: 'verified', quote_amount: 1040, license_verified: true, coi_verified: true }),
        ]);
        // verified should rank first despite costing a bit more
        expect(rows[0].threadId).toBe('verified');
    });

    it('assigns sequential ranks 1..n', () => {
        const rows = rankQuotes([base({ thread_id: 'a' }), base({ thread_id: 'b' }), base({ thread_id: 'c' })]);
        expect(rows.map(r => r.rank)).toEqual([1, 2, 3]);
    });
});

describe('buildQuotesCsv', () => {
    it('produces a header row and one row per quote, with valid escaping', () => {
        const rows = rankQuotes([base({ thread_id: 'a', quote_amount: 2500, exclusions: 'No permit, extra hour' })]);
        const csv = buildQuotesCsv(rows);
        const lines = csv.split('\n');
        expect(lines[0]).toContain('rank,amount');
        expect(lines.length).toBe(2);
        // field containing comma must be quoted
        expect(lines[1]).toContain('"No permit, extra hour"');
    });
});

describe('summarizeTop', () => {
    it('summarizes top N with rank, amount, days and verification', () => {
        const rows = rankQuotes([
            base({ thread_id: 'a', quote_amount: 2000, estimated_days: 4 }),
            base({ thread_id: 'b', quote_amount: 2600, estimated_days: 2 }),
        ]);
        const summary = summarizeTop(rows, 2);
        expect(summary).toContain('#1');
        expect(summary).toContain('$2,000');
        expect(summary).toContain('4d');
    });
});
