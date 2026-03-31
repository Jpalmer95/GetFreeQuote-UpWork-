import { Job, AgentConfig } from '@/types';

export interface VendorMatch {
    config: AgentConfig;
    score: number;
    reasons: string[];
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

export function matchVendorsToJob(
    job: Job,
    vendors: AgentConfig[],
    vendorActiveJobCount: Map<string, number>,
): VendorMatch[] {
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

        // For local requests, skip legacy text service-area filtering: geospatial
        // radius matching is handled below with real coordinates. Text matching
        // would incorrectly exclude vendors inside the radius whose service-area
        // text doesn't string-match job.location.
        if (!job.isLocalRequest && vc.serviceArea.length > 0 && job.location) {
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
            const activeCount = vendorActiveJobCount.get(vc.userId) ?? 0;
            if (activeCount >= vc.maxActiveJobs) continue;

            const capacityUsed = activeCount / vc.maxActiveJobs;
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

        if (job.isLocalRequest && job.locationLat != null && job.locationLng != null) {
            const jobLat = job.locationLat;
            const jobLng = job.locationLng;
            const radiusLimit = job.radiusMiles ?? 25;

            if (vc.locationLat != null && vc.locationLng != null) {
                // Primary path: geospatial hard filter using profile coordinates.
                const dist = haversineMiles(jobLat, jobLng, vc.locationLat, vc.locationLng);
                if (dist > radiusLimit) continue;
                if (dist <= radiusLimit * 0.25) { score += 20; reasons.push('local_very_close'); }
                else if (dist <= radiusLimit * 0.5) { score += 15; reasons.push('local_close'); }
                else { score += 10; reasons.push('local_within_radius'); }
            } else if (vc.serviceArea && vc.serviceArea.length > 0) {
                // Fallback: vendor has declared service areas but no stored coordinates.
                // Use text matching between vendor service areas and the job's location text
                // as a deterministic locality gate (same algorithm as non-local path above).
                // If service areas don't mention the job's location, exclude.
                if (job.location) {
                    const jobLocLower = job.location.toLowerCase();
                    const areaMatch = vc.serviceArea.some((area: string) => {
                        const areaLower = area.toLowerCase();
                        return jobLocLower.includes(areaLower) || areaLower.includes(jobLocLower);
                    });
                    if (!areaMatch) continue;
                }
                score += 5;
                reasons.push('local_service_area_fallback');
            } else {
                // No coordinates and no service area — cannot place vendor geographically.
                continue;
            }
        }

        matched.push({ config: vc, score, reasons });
    }

    matched.sort((a, b) => b.score - a.score);
    return matched;
}
