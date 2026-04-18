/**
 * Volunteer Hours & Community Credits Service
 * 
 * Tracks volunteer hours, converts to community credits,
 * and manages credit spending for project discounts.
 */

import { VolunteerLog, CommunityCredits, CreditTransaction } from '@/types';

// Credit multipliers by role
const ROLE_MULTIPLIERS: Record<string, number> = {
    'skilled_trade': 2.0,    // skilled work earns 2x
    'coordination': 1.5,     // organizing earns 1.5x
    'general_labor': 1.0,    // basic labor earns 1x
    'supervision': 1.3,
    'transport': 1.0,
    'donation': 0.5,         // material donations earn less
};

// Credit expiration (credits expire after N months if unused)
const CREDIT_EXPIRY_MONTHS = 24;

// Credit redemption rate (1 credit = $X discount)
const CREDIT_VALUE_USD = 10;

/**
 * Log volunteer hours and calculate earned credits
 */
export function logVolunteerHours(
    userId: string,
    communityProjectId: string,
    hoursWorked: number,
    role: string,
    notes?: string
): { log: VolunteerLog; creditsEarned: number } {
    const multiplier = ROLE_MULTIPLIERS[role] ?? 1.0;
    const creditsEarned = Math.round(hoursWorked * multiplier * 10) / 10;

    const log: VolunteerLog = {
        id: `vol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        communityProjectId,
        hoursWorked,
        role,
        date: new Date().toISOString(),
        creditsEarned,
        notes,
    };

    return { log, creditsEarned };
}

/**
 * Get or initialize community credits for a user
 */
export function getCommunityCredits(userId: string): CommunityCredits {
    // In production, fetch from DB
    return {
        userId,
        totalEarned: 0,
        totalSpent: 0,
        currentBalance: 0,
        history: [],
    };
}

/**
 * Add credits to a user's account
 */
export function earnCredits(
    credits: CommunityCredits,
    amount: number,
    type: CreditTransaction['type'],
    description: string,
    relatedProjectId?: string,
    relatedJobId?: string
): CommunityCredits {
    const transaction: CreditTransaction = {
        id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: credits.userId,
        amount: Math.abs(amount),
        type,
        description,
        relatedProjectId,
        relatedJobId,
        createdAt: new Date().toISOString(),
    };

    return {
        ...credits,
        totalEarned: credits.totalEarned + Math.abs(amount),
        currentBalance: credits.currentBalance + Math.abs(amount),
        history: [...credits.history, transaction],
    };
}

/**
 * Spend credits (for project discounts)
 */
export function spendCredits(
    credits: CommunityCredits,
    amount: number,
    description: string,
    relatedJobId?: string
): { credits: CommunityCredits; success: boolean; error?: string } {
    if (amount > credits.currentBalance) {
        return {
            credits,
            success: false,
            error: `Insufficient credits. You have ${credits.currentBalance}, tried to spend ${amount}`,
        };
    }

    const transaction: CreditTransaction = {
        id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: credits.userId,
        amount: -Math.abs(amount),
        type: 'project_discount',
        description,
        relatedJobId,
        createdAt: new Date().toISOString(),
    };

    return {
        credits: {
            ...credits,
            totalSpent: credits.totalSpent + Math.abs(amount),
            currentBalance: credits.currentBalance - Math.abs(amount),
            history: [...credits.history, transaction],
        },
        success: true,
    };
}

/**
 * Convert credits to dollar discount
 */
export function creditsToDollars(credits: number): number {
    return Math.round(credits * CREDIT_VALUE_USD * 100) / 100;
}

/**
 * Convert dollars to credits needed
 */
export function dollarsToCredits(dollars: number): number {
    return Math.ceil(dollars / CREDIT_VALUE_USD);
}

/**
 * Process credit expiration (run monthly via cron)
 */
export function expireCredits(credits: CommunityCredits): CommunityCredits {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - CREDIT_EXPIRY_MONTHS);

    const expiredCredits = credits.history
        .filter(t => t.amount > 0 && new Date(t.createdAt) < cutoffDate)
        .reduce((sum, t) => sum + t.amount, 0);

    if (expiredCredits <= 0) return credits;

    const transaction: CreditTransaction = {
        id: `ctx_${Date.now()}_expire`,
        userId: credits.userId,
        amount: -expiredCredits,
        type: 'expired',
        description: `${expiredCredits} credits expired (older than ${CREDIT_EXPIRY_MONTHS} months)`,
        createdAt: new Date().toISOString(),
    };

    return {
        ...credits,
        currentBalance: Math.max(0, credits.currentBalance - expiredCredits),
        history: [...credits.history, transaction],
    };
}

/**
 * Get credit summary for display
 */
export function getCreditSummary(credits: CommunityCredits): {
    balance: number;
    dollarValue: number;
    totalVolunteerHours: number;
    totalEarned: number;
    totalSpent: number;
    nextExpiration?: { amount: number; date: string };
} {
    const dollarValue = creditsToDollars(credits.currentBalance);

    const totalVolunteerHours = credits.history
        .filter(t => t.type === 'volunteer_earned')
        .reduce((sum, t) => {
            // Reverse-calculate hours from credits (approximate)
            return sum + t.amount; // credits = hours * multiplier
        }, 0);

    // Find next expiring credits
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - CREDIT_EXPIRY_MONTHS + 3); // expiring in 3 months
    const expiringCredits = credits.history
        .filter(t => t.amount > 0 && new Date(t.createdAt) < cutoffDate)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const nextExpiration = expiringCredits.length > 0
        ? {
            amount: expiringCredits[0].amount,
            date: new Date(new Date(expiringCredits[0].createdAt).getTime() + CREDIT_EXPIRY_MONTHS * 30 * 24 * 60 * 60 * 1000).toISOString(),
        }
        : undefined;

    return {
        balance: credits.currentBalance,
        dollarValue,
        totalVolunteerHours: Math.round(totalVolunteerHours),
        totalEarned: credits.totalEarned,
        totalSpent: credits.totalSpent,
        nextExpiration,
    };
}

/**
 * Award referral bonus credits
 */
export function awardReferralBonus(
    credits: CommunityCredits,
    referredUserId: string
): CommunityCredits {
    return earnCredits(
        credits,
        5, // 5 credits for referring someone
        'referral_bonus',
        `Referral bonus for referring user ${referredUserId.slice(0, 8)}...`,
    );
}
