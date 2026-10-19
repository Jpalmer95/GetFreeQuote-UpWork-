import { describe, it, expect } from 'vitest';
import {
    workKindFromTags,
    withWorkKindTags,
    parseBudgetAmount,
    isWorkKind,
} from './workKind';

describe('workKindFromTags', () => {
    it('defaults to quote', () => {
        expect(workKindFromTags([])).toBe('quote');
        expect(workKindFromTags(null)).toBe('quote');
    });

    it('reads bounty tag over local flag', () => {
        expect(workKindFromTags(['kind:bounty'], true)).toBe('bounty');
    });

    it('treats local tag or flag as local', () => {
        expect(workKindFromTags(['kind:local'])).toBe('local');
        expect(workKindFromTags([], true)).toBe('local');
    });
});

describe('withWorkKindTags', () => {
    it('replaces an existing kind tag and keeps others', () => {
        expect(withWorkKindTags(['roof', 'kind:quote'], 'bounty')).toEqual(['roof', 'kind:bounty']);
    });
});

describe('parseBudgetAmount', () => {
    it('parses the first dollar amount', () => {
        expect(parseBudgetAmount('$500 – $800')).toBe(500);
        expect(parseBudgetAmount('1,200')).toBe(1200);
        expect(parseBudgetAmount('nope')).toBeNull();
    });
});

describe('isWorkKind', () => {
    it('accepts only the three kinds', () => {
        expect(isWorkKind('bounty')).toBe(true);
        expect(isWorkKind('escrow')).toBe(false);
    });
});
