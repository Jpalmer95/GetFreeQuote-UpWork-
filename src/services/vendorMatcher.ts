import { Job, AgentConfig } from '@/types';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface VendorMatch {
    config: AgentConfig;
    score: number;
    reasons: string[];
}

export async function matchVendorsToJob(job: Job, vendors: AgentConfig[]): Promise<VendorMatch[]> {
    const budgetNum = job.budget ? parseFloat(String(job.budget).replace(/[^0-9.]/g, '')) : null;
    const matched: VendorMatch[] = [];

    for (const vc of vendors) {
        let score = 0;
        const reasons: string[] = [];

        if (vc.industries.length > 0) {
            if (vc.industries.includes(job.industryVertical)) {
                score += 30;
                reasons.push('industry_match');
            } else {
                continue;
            }
        } else {
            score += 10;
            reasons.push('accepts_all_industries');
        }

        if (vc.specialties.length > 0) {
            const jobTerms = [job.subcategory, ...(job.tags || []), job.category].map(s => (s || '').toLowerCase());
            const specialtyMatch = vc.specialties.some((s: string) =>
                jobTerms.some((t: string) => t.includes(s.toLowerCase()) || s.toLowerCase().includes(t))
            );
            if (specialtyMatch) {
                score += 25;
                reasons.push('specialty_match');
            } else {
                score += 5;
                reasons.push('no_specialty_match');
            }
        }

        if (vc.maxBudget && budgetNum && budgetNum > vc.maxBudget) continue;
        if (vc.minBudget && budgetNum && budgetNum < vc.minBudget) continue;

        if (budgetNum && vc.minBudget && vc.maxBudget) {
            score += 15;
            reasons.push('budget_in_range');
        }

        if (vc.serviceArea.length > 0 && job.location) {
            const jobLocationLower = job.location.toLowerCase();
            const locationMatch = vc.serviceArea.some((area: string) => {
                const areaLower = area.toLowerCase();
                return jobLocationLower.includes(areaLower) || areaLower.includes(jobLocationLower);
            });
            if (locationMatch) {
                score += 20;
                reasons.push('location_match');
            } else {
                continue;
            }
        }

        if (vc.maxActiveJobs) {
            const { count: activeQuoteCount } = await supabaseAdmin
                .from('quotes')
                .select('*', { count: 'exact', head: true })
                .eq('vendor_id', vc.userId)
                .eq('status', 'ACCEPTED');

            if (activeQuoteCount !== null && activeQuoteCount >= vc.maxActiveJobs) {
                continue;
            }
            const capacityUsed = activeQuoteCount ? activeQuoteCount / vc.maxActiveJobs : 0;
            if (capacityUsed < 0.5) {
                score += 10;
                reasons.push('high_capacity_available');
            } else if (capacityUsed < 0.8) {
                score += 5;
                reasons.push('moderate_capacity_available');
            } else {
                reasons.push('low_capacity_remaining');
            }
        }

        if (vc.workingHoursOnly) {
            const hour = new Date().getUTCHours();
            if (hour < 9 || hour > 17) {
                score -= 5;
                reasons.push('outside_working_hours');
            } else {
                score += 5;
                reasons.push('within_working_hours');
            }
        }

        if (vc.autoQuote) { score += 10; reasons.push('auto_quote_enabled'); }
        if (vc.autoRespond) { score += 5; reasons.push('auto_respond_enabled'); }

        matched.push({ config: vc, score, reasons });
    }

    matched.sort((a, b) => b.score - a.score);
    return matched;
}
