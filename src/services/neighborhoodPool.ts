/**
 * Neighborhood Pool Build Service
 * 
 * Manages group projects where neighbors pool resources
 * for bulk contractor pricing on shared work.
 */

import { NeighborhoodPool, PoolParticipant } from '@/types';
import { haversineDistance, GPSPoint } from './gpsTracking';

// Pool discount tiers based on number of participants
const POOL_DISCOUNT_TIERS: { minParticipants: number; discountPercent: number }[] = [
    { minParticipants: 20, discountPercent: 35 },
    { minParticipants: 15, discountPercent: 30 },
    { minParticipants: 10, discountPercent: 25 },
    { minParticipants: 7, discountPercent: 20 },
    { minParticipants: 5, discountPercent: 15 },
    { minParticipants: 3, discountPercent: 10 },
    { minParticipants: 2, discountPercent: 5 },
    { minParticipants: 0, discountPercent: 0 },
];

interface PoolCreateInput {
    title: string;
    description: string;
    workType: string;
    location: string;
    locationLat: number;
    locationLng: number;
    radiusMiles: number;
    organizerId: string;
    minParticipants: number;
    maxParticipants: number;
    estimatedIndividualCost: number;
    deadlineDays?: number;
}

/**
 * Create a new neighborhood pool
 */
export function createNeighborhoodPool(input: PoolCreateInput): NeighborhoodPool {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (input.deadlineDays ?? 30));

    const { estimatedPoolCost, savingsPercent } = calculatePoolPricing(
        input.estimatedIndividualCost,
        input.minParticipants
    );

    return {
        id: `pool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: input.title,
        description: input.description,
        workType: input.workType,
        location: input.location,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        radiusMiles: input.radiusMiles,
        organizerId: input.organizerId,
        minParticipants: input.minParticipants,
        maxParticipants: input.maxParticipants,
        currentParticipants: [],
        estimatedIndividualCost: input.estimatedIndividualCost,
        estimatedPoolCost,
        savingsPercent,
        status: 'gathering',
        deadline: deadline.toISOString(),
        createdAt: new Date().toISOString(),
    };
}

/**
 * Calculate pool pricing based on participant count
 */
function calculatePoolPricing(
    individualCost: number,
    participantCount: number
): { estimatedPoolCost: number; savingsPercent: number; savingsAmount: number } {
    let discountPercent = 0;

    for (const tier of POOL_DISCOUNT_TIERS) {
        if (participantCount >= tier.minParticipants) {
            discountPercent = tier.discountPercent;
            break;
        }
    }

    const estimatedPoolCost = Math.round(individualCost * (1 - discountPercent / 100));
    const savingsAmount = individualCost - estimatedPoolCost;

    return {
        estimatedPoolCost,
        savingsPercent: discountPercent,
        savingsAmount,
    };
}

/**
 * Add a participant to the pool
 */
export function joinPool(
    pool: NeighborhoodPool,
    userId: string,
    userName: string,
    address: string,
    addressLat: number,
    addressLng: number,
    specialRequests?: string
): { pool: NeighborhoodPool; participant: PoolParticipant; error?: string } {
    // Check pool status
    if (pool.status !== 'gathering') {
        return { pool, participant: {} as PoolParticipant, error: 'Pool is no longer accepting participants' };
    }

    // Check deadline
    if (new Date(pool.deadline) < new Date()) {
        return { pool, participant: {} as PoolParticipant, error: 'Pool deadline has passed' };
    }

    // Check max participants
    if (pool.currentParticipants.length >= pool.maxParticipants) {
        return { pool, participant: {} as PoolParticipant, error: 'Pool is full' };
    }

    // Check if already joined
    if (pool.currentParticipants.some(p => p.userId === userId)) {
        return { pool, participant: {} as PoolParticipant, error: 'You have already joined this pool' };
    }

    // Check if within radius
    const poolPoint: GPSPoint = { lat: pool.locationLat, lng: pool.locationLng, timestamp: '' };
    const participantPoint: GPSPoint = { lat: addressLat, lng: addressLng, timestamp: '' };
    const distance = haversineDistance(poolPoint, participantPoint);

    if (distance > pool.radiusMiles) {
        return {
            pool,
            participant: {} as PoolParticipant,
            error: `Your location is ${Math.round(distance)} miles away, outside the ${pool.radiusMiles} mile pool radius`,
        };
    }

    // Calculate pricing for new participant count
    const newCount = pool.currentParticipants.length + 1;
    const { estimatedPoolCost, savingsPercent, savingsAmount } = calculatePoolPricing(
        pool.estimatedIndividualCost,
        newCount
    );

    const participant: PoolParticipant = {
        userId,
        userName,
        address,
        addressLat,
        addressLng,
        agreedAmount: estimatedPoolCost,
        paid: false,
        joinedAt: new Date().toISOString(),
        specialRequests,
    };

    // Update all existing participants with new (better) pricing
    const updatedParticipants = pool.currentParticipants.map(p => ({
        ...p,
        agreedAmount: estimatedPoolCost,
    }));

    const updatedPool: NeighborhoodPool = {
        ...pool,
        currentParticipants: [...updatedParticipants, participant],
        estimatedPoolCost,
        savingsPercent,
        status: newCount >= pool.minParticipants ? 'funded' : 'gathering',
    };

    return { pool: updatedPool, participant };
}

/**
 * Remove a participant from the pool
 */
export function leavePool(
    pool: NeighborhoodPool,
    userId: string
): { pool: NeighborhoodPool; error?: string } {
    if (pool.status !== 'gathering' && pool.status !== 'funded') {
        return { pool, error: 'Cannot leave after contractor has been selected' };
    }

    const participant = pool.currentParticipants.find(p => p.userId === userId);
    if (!participant) {
        return { pool, error: 'You are not a participant in this pool' };
    }

    if (participant.paid) {
        return { pool, error: 'Cannot leave after payment. Request a refund instead.' };
    }

    const newCount = pool.currentParticipants.length - 1;
    const { estimatedPoolCost, savingsPercent } = calculatePoolPricing(
        pool.estimatedIndividualCost,
        newCount
    );

    const remainingParticipants = pool.currentParticipants
        .filter(p => p.userId !== userId)
        .map(p => ({ ...p, agreedAmount: estimatedPoolCost }));

    return {
        pool: {
            ...pool,
            currentParticipants: remainingParticipants,
            estimatedPoolCost,
            savingsPercent,
            status: newCount >= pool.minParticipants ? 'funded' : 'gathering',
        },
    };
}

/**
 * Get pool progress summary
 */
export function getPoolProgress(pool: NeighborhoodPool): {
    participantCount: number;
    percentToMinimum: number;
    percentToMaximum: number;
    isMinimumMet: boolean;
    spotsRemaining: number;
    totalSavingsPerParticipant: number;
    daysRemaining: number;
    totalPoolValue: number;
} {
    const count = pool.currentParticipants.length;
    const percentToMinimum = pool.minParticipants > 0
        ? Math.min(100, Math.round((count / pool.minParticipants) * 100))
        : 100;
    const percentToMaximum = pool.maxParticipants > 0
        ? Math.min(100, Math.round((count / pool.maxParticipants) * 100))
        : 0;
    const isMinimumMet = count >= pool.minParticipants;
    const spotsRemaining = Math.max(0, pool.maxParticipants - count);
    const totalSavingsPerParticipant = pool.estimatedIndividualCost - pool.estimatedPoolCost;
    const daysRemaining = Math.max(0,
        Math.ceil((new Date(pool.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const totalPoolValue = pool.estimatedPoolCost * count;

    return {
        participantCount: count,
        percentToMinimum,
        percentToMaximum,
        isMinimumMet,
        spotsRemaining,
        totalSavingsPerParticipant,
        daysRemaining,
        totalPoolValue,
    };
}

/**
 * Calculate savings breakdown for display
 */
export function getSavingsBreakdown(pool: NeighborhoodPool): {
    withoutPool: number;
    withPool: number;
    totalSaved: number;
    percentSaved: number;
    perPersonSaved: number;
} {
    const count = Math.max(1, pool.currentParticipants.length);
    const withoutPool = pool.estimatedIndividualCost * count;
    const withPool = pool.estimatedPoolCost * count;
    const totalSaved = withoutPool - withPool;
    const percentSaved = withoutPool > 0 ? Math.round((totalSaved / withoutPool) * 100) : 0;
    const perPersonSaved = pool.estimatedIndividualCost - pool.estimatedPoolCost;

    return {
        withoutPool,
        withPool,
        totalSaved,
        percentSaved,
        perPersonSaved,
    };
}

/**
 * Find nearby pools a user could join
 */
export function findNearbyPools(
    userLat: number,
    userLng: number,
    pools: NeighborhoodPool[],
    maxDistanceMiles: number = 25
): { pool: NeighborhoodPool; distanceMiles: number }[] {
    const userPoint: GPSPoint = { lat: userLat, lng: userLng, timestamp: '' };

    return pools
        .filter(p => p.status === 'gathering')
        .map(pool => {
            const poolPoint: GPSPoint = { lat: pool.locationLat, lng: pool.locationLng, timestamp: '' };
            const distance = haversineDistance(userPoint, poolPoint);
            return { pool, distanceMiles: Math.round(distance * 10) / 10 };
        })
        .filter(({ pool, distanceMiles }) => distanceMiles <= Math.min(maxDistanceMiles, pool.radiusMiles))
        .sort((a, b) => a.distanceMiles - b.distanceMiles);
}
