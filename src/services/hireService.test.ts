import { generateWorkOrder, proposeSiteVisitWindows } from '@/services/hireService';
import { echoLlmProvider, getActiveLlmProvider } from '@/services/providers';

describe('generateWorkOrder', () => {
    it('includes scope, price, payment and sequence-liability clauses', () => {
        const wo = generateWorkOrder({
            vendorName: 'ACME Electric',
            scope: 'Full panel + rough-in',
            price: 4200,
            startDate: '2026-09-10',
            durationDays: 3,
            exclusions: 'No permits',
            licenseRequired: true,
        });
        expect(wo).toContain('ACME Electric');
        expect(wo).toContain('Full panel + rough-in');
        expect(wo).toContain('$4,200');
        expect(wo).toContain('2026-09-10');
        expect(wo).toContain('No permits');
        expect(wo).toContain('Licensed + insured');
        expect(wo).toContain('payable upon completion');
        expect(wo).toMatch(/[Ss]equence liability/);
    });
});

describe('proposeSiteVisitWindows', () => {
    it('returns three consecutive dates starting from the availability date', () => {
        const windows = proposeSiteVisitWindows('2026-09-10');
        expect(windows).toHaveLength(3);
        expect(windows[0]).toBe('2026-09-10');
        expect(windows[1]).toBe('2026-09-11');
        expect(windows[2]).toBe('2026-09-12');
    });

    it('falls back to ~2 weeks out when no date is given', () => {
        const windows = proposeSiteVisitWindows(null);
        const first = new Date(windows[0]);
        const now = new Date();
        const diffDays = (first.getTime() - now.getTime()) / 86400000;
        expect(diffDays).toBeGreaterThan(10);
        expect(diffDays).toBeLessThan(20);
    });
});

describe('providers', () => {
    it('echo LLM returns the last message (offline/dev default)', async () => {
        const out = await echoLlmProvider.chat([{ role: 'user', content: 'hi' }]);
        expect(out).toBe('hi');
    });

    it('getActiveLlmProvider never returns undefined (echo fallback)', () => {
        expect(getActiveLlmProvider().id).toBeTruthy();
    });
});
