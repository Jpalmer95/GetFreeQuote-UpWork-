/**
 * Trust Score Calculation Service
 * 
 * Calculates a composite trust score (0-100) for vendors based on:
 * - License verification (0-25)
 * - Insurance verification (0-20)
 * - Decay-weighted review score (0-20)
 * - Completion rate (0-15)
 * - Response time (0-10)
 * - Dispute resolution history (0-10)
 */

import {
    TrustScoreBreakdown,
    VendorProfile,
    VendorReviewEnhanced,
} from '@/types';

// Weight constants
const WEIGHTS = {
    license: 25,
    insurance: 20,
    reviews: 20,
    completion: 15,
    responseTime: 10,
    disputes: 10,
};

// Review decay: reviews older than this lose weight exponentially
const REVIEW_DECAY_HALFLIFE_DAYS = 365;

// Badge thresholds
const FAIR_PRICER_THRESHOLD = 0.85; // bids within 15% of market rate 80%+ of time
const TOP_RATED_PERCENTILE = 0.10;  // top 10%
const VETERAN_YEARS = 3;
const FAST_RESPONDER_MINUTES = 60;

interface TrustScoreInput {
    profile: VendorProfile;
    reviews: VendorReviewEnhanced[];
    completedJobs: number;
    cancelledJobs: number;
    totalJobs: number;
    avgResponseMinutes: number;
    disputesTotal: number;
    disputesResolved: number;
    yearsOnPlatform: number;
    bidVsMarketRatios: number[]; // historical ratios of vendor bids to market rate
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
    const {
        profile,
        reviews,
        completedJobs,
        cancelledJobs,
        totalJobs,
        avgResponseMinutes,
        disputesTotal,
        disputesResolved,
        yearsOnPlatform,
        bidVsMarketRatios,
    } = input;

    // 1. License score (0-25)
    const licenseVerified = !!profile.licenseNumber;
    const licenseScore = licenseVerified ? WEIGHTS.license : 0;

    // 2. Insurance score (0-20)
    const insuranceVerified = !!profile.insuranceDetails;
    const insuranceExpired = profile.insuranceExpiry
        ? new Date(profile.insuranceExpiry) < new Date()
        : true;
    const insuranceScore = insuranceVerified && !insuranceExpired ? WEIGHTS.insurance : 0;

    // 3. Review score (0-20) - decay-weighted
    const { weightedAvg, decayScore } = calculateDecayWeightedReviews(reviews);
    const reviewScore = decayScore;
    const reviewCount = reviews.length;

    // 4. Completion rate (0-15)
    const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 0;
    const completionScore = completionRate * WEIGHTS.completion;

    // 5. Response time score (0-10)
    const responseTimeScore = calculateResponseTimeScore(avgResponseMinutes);

    // 6. Dispute score (0-10)
    const disputeScore = calculateDisputeScore(disputesTotal, disputesResolved, completedJobs);

    // Overall score
    const overallScore = Math.round(
        licenseScore +
        insuranceScore +
        reviewScore +
        completionScore +
        responseTimeScore +
        disputeScore
    );

    // Badges
    const fairPricerBadge = calculateFairPricerBadge(bidVsMarketRatios);
    const topRatedBadge = false; // calculated externally vs area competitors
    const veteranBadge = yearsOnPlatform >= VETERAN_YEARS;
    const fastResponderBadge = avgResponseMinutes <= FAST_RESPONDER_MINUTES;

    return {
        vendorId: profile.id,
        overallScore: Math.min(100, Math.max(0, overallScore)),
        licenseVerified,
        licenseScore,
        insuranceVerified,
        insuranceScore,
        insuranceExpiry: profile.insuranceExpiry,
        bondVerified: false, // TODO: add bond verification
        reviewScore,
        reviewCount,
        reviewWeightedAvg: weightedAvg,
        completionRate,
        completedJobs,
        cancelledJobs,
        responseTimeScore,
        avgResponseMinutes,
        disputeScore,
        disputesTotal,
        disputesResolved,
        fairPricerBadge,
        topRatedBadge,
        veteranBadge,
        fastResponderBadge,
        calculatedAt: new Date().toISOString(),
    };
}

function calculateDecayWeightedReviews(reviews: VendorReviewEnhanced[]): { weightedAvg: number; decayScore: number } {
    if (reviews.length === 0) return { weightedAvg: 0, decayScore: 0 };

    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    for (const review of reviews) {
        const ageDays = (now - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        // Exponential decay: more recent reviews count more
        const timeWeight = Math.pow(0.5, ageDays / REVIEW_DECAY_HALFLIFE_DAYS);
        // Larger jobs count more (log scale so $50K isn't 1000x a $50 job)
        const sizeWeight = review.jobTotalAmount
            ? 1 + Math.log10(Math.max(1, review.jobTotalAmount / 100))
            : 1;
        // Verified reviews count more
        const verifiedWeight = review.verified ? 1.5 : 1.0;

        const combinedWeight = timeWeight * sizeWeight * verifiedWeight;
        weightedSum += review.rating * combinedWeight;
        weightTotal += combinedWeight;
    }

    const weightedAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;
    // Map 1-5 stars to 0-20 points
    const decayScore = Math.round((weightedAvg / 5) * WEIGHTS.reviews);

    return { weightedAvg: Math.round(weightedAvg * 10) / 10, decayScore };
}

function calculateResponseTimeScore(avgMinutes: number): number {
    // < 15 min = 10 pts, < 30 = 8, < 60 = 6, < 120 = 4, < 240 = 2, else 1
    if (avgMinutes <= 15) return 10;
    if (avgMinutes <= 30) return 8;
    if (avgMinutes <= 60) return 6;
    if (avgMinutes <= 120) return 4;
    if (avgMinutes <= 240) return 2;
    return 1;
}

function calculateDisputeScore(total: number, resolved: number, completedJobs: number): number {
    if (total === 0) return 10; // no disputes = full score

    // Dispute rate vs completed jobs
    const disputeRate = completedJobs > 0 ? total / completedJobs : 1;
    // Resolution rate (resolving disputes is good)
    const resolutionRate = total > 0 ? resolved / total : 1;

    // Low dispute rate + high resolution rate = high score
    const rateScore = Math.max(0, 1 - disputeRate * 10) * 5; // 0-5
    const resolutionScore = resolutionRate * 5; // 0-5

    return Math.round(rateScore + resolutionScore);
}

function calculateFairPricerBadge(bidRatios: number[]): boolean {
    if (bidRatios.length < 5) return false; // need enough data
    const withinRange = bidRatios.filter(r => r >= 0.85 && r <= 1.15).length;
    return (withinRange / bidRatios.length) >= FAIR_PRICER_THRESHOLD;
}

/**
 * Get the trust badge tier for display
 */
export function getTrustBadgeTier(score: number): 'platinum' | 'gold' | 'silver' | 'bronze' | 'unverified' {
    if (score >= 85) return 'platinum';
    if (score >= 70) return 'gold';
    if (score >= 50) return 'silver';
    if (score >= 30) return 'bronze';
    return 'unverified';
}

/**
 * Get human-readable trust score description
 */
export function getTrustDescription(score: number): string {
    if (score >= 85) return 'Exceptionally trusted - fully verified with outstanding track record';
    if (score >= 70) return 'Highly trusted - verified with strong history';
    if (score >= 50) return 'Trusted - good standing with verifiable credentials';
    if (score >= 30) return 'Building trust - some credentials verified';
    return 'New or unverified - limited trust data available';
}
