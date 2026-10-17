import { describe, it, expect } from 'vitest';
import { evaluateFormula, sanitizeIlike } from '../lib/safeEval';

describe('evaluateFormula', () => {
    it('evaluates arithmetic with substituted vars', () => {
        expect(evaluateFormula('hours * rate', { hours: 4, rate: 50 }, 0)).toBe(200);
        expect(evaluateFormula('(sqft + 10) * 2', { sqft: 5 }, 0)).toBe(30);
    });

    it('rejects identifiers that survive substitution', () => {
        expect(evaluateFormula('process.exit()', { hours: 1 }, 99)).toBe(99);
        expect(evaluateFormula('hours + foo', { hours: 1 }, 7)).toBe(7);
    });

    it('returns fallback on empty / invalid', () => {
        expect(evaluateFormula('', {}, 3)).toBe(3);
        expect(evaluateFormula('1 / 0', {}, 3)).toBe(3);
    });
});

describe('sanitizeIlike', () => {
    it('strips PostgREST wildcards and punctuation', () => {
        expect(sanitizeIlike('roof%,(drop)')).toBe('roof drop');
    });
});
