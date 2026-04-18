/**
 * Surge Pricing Engine
 * 
 * Calculates dynamic surge multipliers based on real-time
 * demand/supply ratio in a geographic area.
 */

import { SurgeState, SurgeCategory, SurgeHistory } from '@/types';

// Surge thresholds: demand/supply ratio -> multiplier
const SURGE_TIERS: { minRatio: number; multiplier: number; level: SurgeState['level'] }[] = [
    { minRatio: 5.0, multiplier: 2.5, level: 'extreme' },
    { minRatio: 3.0, multiplier: 2.0, level: 'extreme' },
    { minRatio: 2.0, multiplier: 1.75, level: 'high' },
    { minRatio: 1.5, multiplier: 1.5, level: 'high' },
    { minRatio: 1.2, multiplier: 1.25, level: 'moderate' },
    { minRatio: 1.0, multiplier: 1.1, level: 'moderate' },
    { minRatio: 0, multiplier: 1.0, level: 'normal' },
];

// How long a surge state lasts before recalculating
const SURGE_WINDOW_MINUTES = 15;

// Minimum counts to trigger surge (avoid surging on 2 jobs, 1 vendor)
const MIN_DEMAND_FOR_SURGE = 3;
const MIN_SUPPLY_FOR_SURGE = 2;

interface SurgeInput {
    category: SurgeCategory;
    geoHash: string;
    demandCount: number;  // active jobs requesting this category in area
    supplyCount: number;  // available vendors for this category in area
    timeOfDay?: number;   // hour 0-23 (for time-based adjustments)
    dayOfWeek?: number;   // 0-6 (for day-based adjustments)
    isEmergency?: boolean;
    weatherCondition?: 'clear' | 'rain' | 'storm' | 'extreme';
}

export function calculateSurge(input: SurgeInput): SurgeState {
    const {
        category,
        geoHash,
        demandCount,
        supplyCount,
        timeOfDay,
        dayOfWeek,
        isEmergency,
        weatherCondition,
    } = input;

    // Base ratio
    let ratio = supplyCount > 0 ? demandCount / supplyCount : demandCount;

    // Apply time-of-day multiplier
    if (timeOfDay !== undefined) {
        const timeMultiplier = getTimeMultiplier(timeOfDay, dayOfWeek);
        ratio *= timeMultiplier;
    }

    // Weather adjustments (bad weather = fewer vendors = more surge)
    if (weatherCondition === 'storm' || weatherCondition === 'extreme') {
        ratio *= 1.5;
    } else if (weatherCondition === 'rain') {
        ratio *= 1.2;
    }

    // Emergency requests always surge
    if (isEmergency) {
        ratio = Math.max(ratio, 2.0);
    }

    // Find the appropriate surge tier
    let multiplier = 1.0;
    let level: SurgeState['level'] = 'normal';

    // Only apply surge if minimum thresholds met
    if (demandCount >= MIN_DEMAND_FOR_SURGE && supplyCount >= MIN_SUPPLY_FOR_SURGE) {
        for (const tier of SURGE_TIERS) {
            if (ratio >= tier.minRatio) {
                multiplier = tier.multiplier;
                level = tier.level;
                break;
            }
        }
    }

    // Cap multiplier
    multiplier = Math.min(3.0, Math.max(1.0, multiplier));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SURGE_WINDOW_MINUTES * 60 * 1000);

    return {
        category,
        geoHash,
        currentMultiplier: Math.round(multiplier * 100) / 100,
        demandCount,
        supplyCount,
        demandSupplyRatio: Math.round(ratio * 100) / 100,
        level,
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
}

function getTimeMultiplier(hour: number, dayOfWeek?: number): number {
    // Peak hours: early morning (7-9), lunch (11-13), evening (17-20)
    // Off-peak: late night (22-6)
    const isWeekend = dayOfWeek !== undefined && (dayOfWeek === 0 || dayOfWeek === 6);

    // Late night = lower supply
    if (hour >= 22 || hour < 6) return 1.4;
    
    // Morning rush
    if (hour >= 7 && hour <= 9) return 1.3;
    
    // Lunch rush
    if (hour >= 11 && hour <= 13) return 1.2;
    
    // Evening rush (bigger on weekdays)
    if (hour >= 17 && hour <= 20) return isWeekend ? 1.1 : 1.3;
    
    // Normal hours
    return 1.0;
}

/**
 * Apply surge multiplier to a price
 */
export function applySurgePrice(basePrice: number, surge: SurgeState): {
    originalPrice: number;
    surgePrice: number;
    surgeMultiplier: number;
    surgeAmount: number;
    isSurging: boolean;
} {
    const isSurging = surge.currentMultiplier > 1.0;
    const surgePrice = isSurging ? Math.round(basePrice * surge.currentMultiplier) : basePrice;

    return {
        originalPrice: basePrice,
        surgePrice,
        surgeMultiplier: surge.currentMultiplier,
        surgeAmount: surgePrice - basePrice,
        isSurging,
    };
}

/**
 * Get human-readable surge explanation
 */
export function getSurgeExplanation(surge: SurgeState): string {
    if (surge.level === 'normal') return 'Normal pricing';

    const percent = Math.round((surge.currentMultiplier - 1) * 100);
    const reasons: string[] = [];

    if (surge.demandSupplyRatio > 2) {
        reasons.push(`${surge.demandCount} jobs competing for ${surge.supplyCount} workers`);
    } else if (surge.demandSupplyRatio > 1.2) {
        reasons.push('higher than usual demand in your area');
    }

    let explanation = `+${percent}% surge pricing`;
    if (reasons.length > 0) {
        explanation += ` due to ${reasons.join(' and ')}`;
    }

    return explanation;
}

/**
 * Predict future surge times (for planning)
 */
export function predictSurgeWindows(category: SurgeCategory): {
    day: string;
    peakHours: string;
    predictedLevel: string;
}[] {
    // Based on typical patterns
    return [
        { day: 'Weekdays', peakHours: '7-9 AM, 5-7 PM', predictedLevel: 'moderate-high' },
        { day: 'Saturdays', peakHours: '9 AM - 1 PM', predictedLevel: 'moderate' },
        { day: 'Sundays', peakHours: '10 AM - 2 PM', predictedLevel: 'low-moderate' },
        { day: 'Weeknights', peakHours: 'After 9 PM', predictedLevel: 'high (low supply)' },
    ];
}
