/**
 * Lead Quality Scoring Service
 * 
 * Scores job posts for vendor lead quality (0-100):
 * - Description completeness (0-25)
 * - Budget realism (0-20)
 * - User history (0-20)
 * - Urgency (0-15)
 * - Location/vendor density (0-10)
 * - Competition level (0-10)
 */

import { LeadQualityScore, Job, PriceEstimate } from '@/types';

interface LeadQualityInput {
    job: Job;
    userHistory?: {
        jobsPosted: number;
        jobsHired: number;
        avgVendorRating: number;   // how vendors rate this user
        responseRate: number;       // 0-1
    };
    priceEstimate?: PriceEstimate;
    nearbyVendorCount?: number;
    competingQuotes?: number;
}

export function calculateLeadQuality(input: LeadQualityInput): LeadQualityScore {
    const { job, userHistory, priceEstimate, nearbyVendorCount = 0, competingQuotes = 0 } = input;

    // 1. Description score (0-25)
    const descriptionScore = scoreDescription(job);

    // 2. Photo/dimension flags
    const hasPhotos = (job.attachments?.length ?? 0) > 0;
    const hasDimensions = !!(job.squareFootage || job.description.match(/\d+\s*(ft|feet|sqft|sq\s*ft|inch|"|'|x)/i));

    // 3. Budget realism (0-20)
    const { budgetScore, budgetRealism, budgetRangeLow, budgetRangeHigh } = scoreBudget(job, priceEstimate);

    // 4. User score (0-20)
    const { userScore, isReturningUser, userResponseRate, userAvgRating } = scoreUser(userHistory);

    // 5. Urgency score (0-15)
    const urgencyScore = scoreUrgency(job);

    // 6. Location score (0-10)
    const locationScore = scoreLocation(nearbyVendorCount);

    // 7. Competition (0-10)
    const competitionScore = Math.min(10, competingQuotes * 2);

    // Overall
    const overallScore = Math.round(
        descriptionScore + budgetScore + userScore + urgencyScore + locationScore + competitionScore
    );

    // Estimated close time
    const estimatedCloseTime = estimateCloseTime(overallScore, job.urgency);

    return {
        jobId: job.id,
        overallScore: Math.min(100, Math.max(0, overallScore)),
        descriptionScore,
        hasPhotos,
        hasDimensions,
        hasBudget: !!job.budget,
        budgetRealism,
        budgetRangeLow,
        budgetRangeHigh,
        userScore,
        isReturningUser,
        userResponseRate,
        userAvgRating,
        urgencyScore,
        locationScore,
        competingQuotes,
        estimatedCloseTime,
        calculatedAt: new Date().toISOString(),
    };
}

function scoreDescription(job: Job): number {
    let score = 0;
    const desc = job.description || '';
    const title = job.title || '';

    // Title length and quality
    if (title.length >= 10) score += 3;
    if (title.length >= 20) score += 2;

    // Description length
    if (desc.length >= 50) score += 3;
    if (desc.length >= 150) score += 3;
    if (desc.length >= 300) score += 2;

    // Specificity indicators
    if (desc.match(/\d+/)) score += 2; // has numbers
    if (desc.match(/material|brand|type|size|color|style/i)) score += 2; // mentions specifics
    if (desc.match(/timeline|deadline|asap|by|before/i)) score += 1; // mentions timing
    if (desc.match(/budget|price|cost|rate/i)) score += 1; // mentions budget
    if (desc.match(/currently|existing|old|new|replace|repair|install/i)) score += 1; // describes current state
    if (job.subcategory && job.subcategory !== 'Other') score += 2; // specific subcategory
    if (job.tags && job.tags.length > 0) score += 2; // has tags

    return Math.min(25, score);
}

function scoreBudget(job: Job, priceEstimate?: PriceEstimate): {
    budgetScore: number;
    budgetRealism: number;
    budgetRangeLow?: number;
    budgetRangeHigh?: number;
} {
    if (!job.budget) {
        return { budgetScore: 0, budgetRealism: 0 };
    }

    const budgetNum = parseFloat(String(job.budget).replace(/[^0-9.]/g, ''));
    if (isNaN(budgetNum) || budgetNum <= 0) {
        return { budgetScore: 2, budgetRealism: 0 };
    }

    let budgetScore = 10; // has a budget = base 10
    let budgetRealism = 10; // neutral start

    if (priceEstimate) {
        const { lowEstimate, highEstimate } = priceEstimate;
        // Budget within or above estimate range = realistic
        if (budgetNum >= lowEstimate * 0.7 && budgetNum <= highEstimate * 1.5) {
            budgetRealism = 20; // very realistic
            budgetScore = 20;
        } else if (budgetNum >= lowEstimate * 0.5) {
            budgetRealism = 12;
            budgetScore = 15;
        } else {
            budgetRealism = 3; // unrealistically low
            budgetScore = 5;
        }

        return {
            budgetScore,
            budgetRealism,
            budgetRangeLow: lowEstimate,
            budgetRangeHigh: highEstimate,
        };
    }

    // No price estimate available - just check if budget is reasonable magnitude
    if (budgetNum >= 50) budgetScore += 3;
    if (budgetNum >= 200) budgetScore += 3;
    if (budgetNum >= 1000) budgetScore += 2;

    return { budgetScore: Math.min(20, budgetScore), budgetRealism: 10 };
}

function scoreUser(history?: LeadQualityInput['userHistory']): {
    userScore: number;
    isReturningUser: boolean;
    userResponseRate: number;
    userAvgRating: number;
} {
    if (!history) {
        return { userScore: 0, isReturningUser: false, userResponseRate: 0, userAvgRating: 0 };
    }

    let score = 0;
    const isReturningUser = history.jobsPosted > 0;

    // Posted before
    if (history.jobsPosted >= 1) score += 3;
    if (history.jobsPosted >= 5) score += 3;
    if (history.jobsPosted >= 10) score += 2;

    // Hired before (good sign they're serious)
    if (history.jobsHired >= 1) score += 4;
    if (history.jobsHired >= 3) score += 2;

    // Response rate
    score += Math.round(history.responseRate * 3);

    // Vendor rating of this user
    if (history.avgVendorRating >= 4) score += 3;
    else if (history.avgVendorRating >= 3) score += 1;

    return {
        userScore: Math.min(20, score),
        isReturningUser,
        userResponseRate: history.responseRate,
        userAvgRating: history.avgVendorRating,
    };
}

function scoreUrgency(job: Job): number {
    switch (job.urgency) {
        case 'urgent': return 15;
        case 'within_week': return 12;
        case 'within_month': return 8;
        case 'flexible': return 5;
        default: return 5;
    }
}

function scoreLocation(vendorCount: number): number {
    // More vendors in area = better for vendors (more opportunity)
    if (vendorCount >= 50) return 10;
    if (vendorCount >= 20) return 8;
    if (vendorCount >= 10) return 6;
    if (vendorCount >= 5) return 4;
    return 2;
}

function estimateCloseTime(score: number, urgency?: string): string {
    if (urgency === 'urgent') return 'likely to hire within 24 hours';
    if (score >= 80) return 'likely to hire within 2-3 days';
    if (score >= 60) return 'likely to hire within a week';
    if (score >= 40) return 'may take 1-2 weeks to decide';
    return 'exploring options, may not hire immediately';
}

/**
 * Get lead quality badge for display
 */
export function getLeadQualityBadge(score: number): {
    label: string;
    color: string;
    icon: string;
} {
    if (score >= 80) return { label: 'Hot Lead', color: '#ef4444', icon: '🔥' };
    if (score >= 60) return { label: 'Quality Lead', color: '#f59e0b', icon: '⭐' };
    if (score >= 40) return { label: 'Average Lead', color: '#3b82f6', icon: '📋' };
    return { label: 'Exploring', color: '#6b7280', icon: '🔍' };
}
