/**
 * Vendor Performance Analytics Service
 * 
 * Calculates performance metrics, area benchmarks, and competitive insights.
 */

import { VendorAnalytics, AreaBenchmark, TrustScoreBreakdown } from '@/types';

interface AnalyticsInput {
    vendorId: string;
    period: VendorAnalytics['period'];
    jobsBid: number;
    jobsWon: number;
    jobsCompleted: number;
    bidAmounts: number[];
    responseTimesMinutes: number[];
    ratings: number[];
    revenue: number[];
    repeatCustomers: number;
    totalCustomers: number;
    onTimeCompletions: number;
    totalCompleted: number;
    disputes: number;
    categoryPerformance: { category: string; bids: number; wins: number }[];
    marketRates: number[]; // average market rate for each bid
    areaBenchmarks?: AreaBenchmark[];
    ratingHistory?: { rating: number; date: string }[]; // for trend
}

export function calculateVendorAnalytics(input: AnalyticsInput): VendorAnalytics {
    const {
        vendorId, period, jobsBid, jobsWon, jobsCompleted,
        bidAmounts, responseTimesMinutes, ratings, revenue,
        repeatCustomers, totalCustomers, onTimeCompletions,
        totalCompleted, disputes, categoryPerformance, marketRates,
        ratingHistory,
    } = input;

    const now = new Date();
    const { periodStart, periodEnd } = getPeriodDates(period, now);

    // Win rate
    const winRate = jobsBid > 0 ? jobsWon / jobsBid : 0;

    // Average bid
    const avgBidAmount = bidAmounts.length > 0
        ? bidAmounts.reduce((a, b) => a + b, 0) / bidAmounts.length
        : 0;

    // Market rate comparison
    const avgMarketRate = marketRates.length > 0
        ? marketRates.reduce((a, b) => a + b, 0) / marketRates.length
        : 0;
    const bidVsMarketRatio = avgMarketRate > 0 ? avgBidAmount / avgMarketRate : 1;

    // Response time
    const avgResponseTimeMinutes = responseTimesMinutes.length > 0
        ? responseTimesMinutes.reduce((a, b) => a + b, 0) / responseTimesMinutes.length
        : 0;

    // Rating
    const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    // Rating trend
    const ratingTrend = calculateRatingTrend(ratingHistory);

    // Revenue
    const revenueTotal = revenue.reduce((a, b) => a + b, 0);
    const revenuePerJob = jobsCompleted > 0 ? revenueTotal / jobsCompleted : 0;

    // Repeat customer rate
    const repeatCustomerRate = totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;

    // On-time completion
    const onTimeCompletionRate = totalCompleted > 0 ? onTimeCompletions / totalCompleted : 0;

    // Dispute rate
    const disputeRate = jobsCompleted > 0 ? disputes / jobsCompleted : 0;

    // Top categories
    const topCategories = categoryPerformance
        .map(cp => ({
            category: cp.category,
            count: cp.bids,
            winRate: cp.bids > 0 ? cp.wins / cp.bids : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Customer satisfaction (composite of rating + repeat rate + low disputes)
    const customerSatisfactionScore = Math.round(
        (avgRating / 5) * 40 +
        repeatCustomerRate * 30 +
        (1 - disputeRate) * 20 +
        onTimeCompletionRate * 10
    );

    return {
        vendorId,
        period,
        periodStart,
        periodEnd,
        jobsCompleted,
        jobsWon,
        jobsBid,
        winRate: Math.round(winRate * 1000) / 1000,
        avgBidAmount: Math.round(avgBidAmount),
        avgMarketRate: Math.round(avgMarketRate),
        bidVsMarketRatio: Math.round(bidVsMarketRatio * 100) / 100,
        avgResponseTimeMinutes: Math.round(avgResponseTimeMinutes),
        responseTimePercentile: 50, // calculated externally vs area
        avgRating: Math.round(avgRating * 10) / 10,
        ratingTrend,
        revenueTotal: Math.round(revenueTotal),
        revenuePerJob: Math.round(revenuePerJob),
        repeatCustomerRate: Math.round(repeatCustomerRate * 1000) / 1000,
        topCategories,
        customerSatisfactionScore,
        onTimeCompletionRate: Math.round(onTimeCompletionRate * 1000) / 1000,
        disputeRate: Math.round(disputeRate * 1000) / 1000,
    };
}

function getPeriodDates(period: VendorAnalytics['period'], now: Date): { periodStart: string; periodEnd: string } {
    const end = now.toISOString();
    const start = new Date(now);

    switch (period) {
        case 'week': start.setDate(start.getDate() - 7); break;
        case 'month': start.setMonth(start.getMonth() - 1); break;
        case 'quarter': start.setMonth(start.getMonth() - 3); break;
        case 'year': start.setFullYear(start.getFullYear() - 1); break;
        case 'all_time': start.setFullYear(2020); break;
    }

    return { periodStart: start.toISOString(), periodEnd: end };
}

function calculateRatingTrend(
    history?: { rating: number; date: string }[]
): 'improving' | 'stable' | 'declining' {
    if (!history || history.length < 4) return 'stable';

    const sorted = [...history].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const midpoint = Math.floor(sorted.length / 2);
    const firstHalfAvg = sorted.slice(0, midpoint).reduce((s, r) => s + r.rating, 0) / midpoint;
    const secondHalfAvg = sorted.slice(midpoint).reduce((s, r) => s + r.rating, 0) / (sorted.length - midpoint);

    const diff = secondHalfAvg - firstHalfAvg;
    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
}

/**
 * Calculate area benchmark for a category/area
 */
export function calculateAreaBenchmark(
    category: string,
    area: string,
    bids: number[],
    ratings: number[],
    responseTimes: number[],
    vendorCount: number,
    jobsPerMonth: number,
    subcategory?: string
): AreaBenchmark {
    const avgBidAmount = bids.length > 0 ? bids.reduce((a, b) => a + b, 0) / bids.length : 0;
    const sortedBids = [...bids].sort((a, b) => a - b);
    const medianBidAmount = sortedBids.length > 0
        ? sortedBids[Math.floor(sortedBids.length / 2)]
        : 0;
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    return {
        category,
        subcategory,
        area,
        avgBidAmount: Math.round(avgBidAmount),
        medianBidAmount: Math.round(medianBidAmount),
        avgRating: Math.round(avgRating * 10) / 10,
        avgResponseTimeMinutes: Math.round(avgResponseTime),
        vendorCount,
        jobsPerMonth,
        calculatedAt: new Date().toISOString(),
    };
}

/**
 * Generate competitive insights for vendor dashboard
 */
export function generateCompetitiveInsights(
    analytics: VendorAnalytics,
    benchmarks: AreaBenchmark[]
): {
    strengths: string[];
    opportunities: string[];
    alerts: string[];
} {
    const strengths: string[] = [];
    const opportunities: string[] = [];
    const alerts: string[] = [];

    // Rating comparison
    const relevantBenchmark = benchmarks.find(b =>
        analytics.topCategories.some(tc => tc.category === b.category)
    );

    if (relevantBenchmark) {
        if (analytics.avgRating > relevantBenchmark.avgRating + 0.3) {
            strengths.push(`Rating ${analytics.avgRating} is above area average of ${relevantBenchmark.avgRating}`);
        } else if (analytics.avgRating < relevantBenchmark.avgRating - 0.3) {
            alerts.push(`Rating ${analytics.avgRating} is below area average of ${relevantBenchmark.avgRating}`);
        }

        if (analytics.avgResponseTimeMinutes < relevantBenchmark.avgResponseTimeMinutes * 0.5) {
            strengths.push('Response time is much faster than area average');
        } else if (analytics.avgResponseTimeMinutes > relevantBenchmark.avgResponseTimeMinutes * 1.5) {
            opportunities.push('Consider improving response time - currently slower than area average');
        }

        if (analytics.bidVsMarketRatio < 0.85) {
            opportunities.push('Your bids are below market rate - consider raising prices');
        } else if (analytics.bidVsMarketRatio > 1.15) {
            alerts.push('Your bids are above market rate - may be losing price-sensitive clients');
        }
    }

    // Win rate
    if (analytics.winRate > 0.4) {
        strengths.push(`Strong win rate of ${Math.round(analytics.winRate * 100)}%`);
    } else if (analytics.winRate < 0.15) {
        opportunities.push('Win rate is low - consider reviewing bid strategy or pricing');
    }

    // Repeat customers
    if (analytics.repeatCustomerRate > 0.3) {
        strengths.push(`${Math.round(analytics.repeatCustomerRate * 100)}% repeat customers`);
    } else if (analytics.repeatCustomerRate < 0.1 && analytics.totalCustomers > 5) {
        opportunities.push('Low repeat rate - consider follow-up and relationship building');
    }

    // Disputes
    if (analytics.disputeRate > 0.05) {
        alerts.push(`Dispute rate of ${Math.round(analytics.disputeRate * 100)}% needs attention`);
    }

    // Revenue trend
    if (analytics.revenuePerJob > 0 && analytics.ratingTrend === 'improving') {
        strengths.push('Customer satisfaction is trending upward');
    }

    return { strengths, opportunities, alerts };
}
