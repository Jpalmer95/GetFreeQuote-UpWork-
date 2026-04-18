/**
 * Material Group Buying Service
 * 
 * Aggregates contractor demand for bulk material pricing.
 * Vendors create group buys, others join to reach minimum quantities.
 */

import { MaterialGroupBuy, GroupBuyParticipant } from '@/types';

// Discount tiers based on quantity thresholds
const DISCOUNT_TIERS: { minQty: number; discountPercent: number }[] = [
    { minQty: 1000, discountPercent: 30 },
    { minQty: 500, discountPercent: 25 },
    { minQty: 200, discountPercent: 20 },
    { minQty: 100, discountPercent: 15 },
    { minQty: 50, discountPercent: 12 },
    { minQty: 20, discountPercent: 8 },
    { minQty: 10, discountPercent: 5 },
    { minQty: 0, discountPercent: 0 },
];

/**
 * Calculate group price based on total quantity
 */
export function calculateGroupPrice(
    retailPricePerUnit: number,
    totalQuantity: number
): { groupPrice: number; savingsPercent: number; savingsPerUnit: number } {
    let discountPercent = 0;

    for (const tier of DISCOUNT_TIERS) {
        if (totalQuantity >= tier.minQty) {
            discountPercent = tier.discountPercent;
            break;
        }
    }

    const groupPrice = Math.round(retailPricePerUnit * (1 - discountPercent / 100) * 100) / 100;
    const savingsPerUnit = retailPricePerUnit - groupPrice;

    return {
        groupPrice,
        savingsPercent: discountPercent,
        savingsPerUnit: Math.round(savingsPerUnit * 100) / 100,
    };
}

/**
 * Create a new group buy
 */
export function createGroupBuy(
    organizerId: string,
    materialCategory: string,
    materialDescription: string,
    retailPricePerUnit: number,
    minimumQuantity: number,
    targetQuantity: number,
    deadlineDays: number = 14,
    deliveryLocation?: string
): MaterialGroupBuy {
    const { groupPrice, savingsPercent } = calculateGroupPrice(retailPricePerUnit, targetQuantity);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

    return {
        id: `groupbuy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        organizerId,
        materialCategory,
        materialDescription,
        retailPricePerUnit,
        groupPricePerUnit: groupPrice,
        minimumQuantity,
        currentQuantity: 0,
        targetQuantity,
        savingsPercent,
        participants: [],
        status: 'gathering',
        deadline: deadline.toISOString(),
        deliveryLocation,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Join a group buy
 */
export function joinGroupBuy(
    groupBuy: MaterialGroupBuy,
    vendorId: string,
    vendorName: string,
    quantity: number
): { groupBuy: MaterialGroupBuy; participant: GroupBuyParticipant; error?: string } {
    if (groupBuy.status !== 'gathering') {
        return {
            groupBuy,
            participant: {} as GroupBuyParticipant,
            error: 'Group buy is no longer accepting participants',
        };
    }

    if (new Date(groupBuy.deadline) < new Date()) {
        return {
            groupBuy,
            participant: {} as GroupBuyParticipant,
            error: 'Group buy deadline has passed',
        };
    }

    // Check if vendor already joined
    const existing = groupBuy.participants.find(p => p.vendorId === vendorId);
    if (existing) {
        return {
            groupBuy,
            participant: {} as GroupBuyParticipant,
            error: 'You have already joined this group buy',
        };
    }

    const newQuantity = groupBuy.currentQuantity + quantity;
    const { groupPrice, savingsPercent } = calculateGroupPrice(
        groupBuy.retailPricePerUnit,
        newQuantity
    );

    const participant: GroupBuyParticipant = {
        vendorId,
        vendorName,
        quantity,
        totalPrice: Math.round(groupPrice * quantity * 100) / 100,
        joinedAt: new Date().toISOString(),
        paid: false,
    };

    const updatedGroupBuy: MaterialGroupBuy = {
        ...groupBuy,
        currentQuantity: newQuantity,
        groupPricePerUnit: groupPrice,
        savingsPercent,
        participants: [...groupBuy.participants, participant],
        status: newQuantity >= groupBuy.minimumQuantity ? 'confirmed' : 'gathering',
    };

    return { groupBuy: updatedGroupBuy, participant };
}

/**
 * Leave a group buy (before deadline)
 */
export function leaveGroupBuy(
    groupBuy: MaterialGroupBuy,
    vendorId: string
): { groupBuy: MaterialGroupBuy; error?: string } {
    if (groupBuy.status !== 'gathering' && groupBuy.status !== 'confirmed') {
        return { groupBuy, error: 'Cannot leave after order is placed' };
    }

    const participant = groupBuy.participants.find(p => p.vendorId === vendorId);
    if (!participant) {
        return { groupBuy, error: 'You are not a participant' };
    }

    const newQuantity = groupBuy.currentQuantity - participant.quantity;
    const { groupPrice, savingsPercent } = calculateGroupPrice(
        groupBuy.retailPricePerUnit,
        newQuantity
    );

    return {
        groupBuy: {
            ...groupBuy,
            currentQuantity: newQuantity,
            groupPricePerUnit: groupPrice,
            savingsPercent,
            participants: groupBuy.participants.filter(p => p.vendorId !== vendorId),
            status: newQuantity >= groupBuy.minimumQuantity ? 'confirmed' : 'gathering',
        },
    };
}

/**
 * Get group buy progress for display
 */
export function getGroupBuyProgress(groupBuy: MaterialGroupBuy): {
    percentToTarget: number;
    percentToMinimum: number;
    isMinimumMet: boolean;
    spotsRemaining: number;
    totalSavingsPerUnit: number;
    daysRemaining: number;
} {
    const percentToTarget = groupBuy.targetQuantity > 0
        ? Math.round((groupBuy.currentQuantity / groupBuy.targetQuantity) * 100)
        : 0;

    const percentToMinimum = groupBuy.minimumQuantity > 0
        ? Math.round((groupBuy.currentQuantity / groupBuy.minimumQuantity) * 100)
        : 100;

    const isMinimumMet = groupBuy.currentQuantity >= groupBuy.minimumQuantity;

    // Assuming individual max ~50 units per vendor
    const estimatedMaxParticipants = Math.ceil(groupBuy.targetQuantity / 50);
    const spotsRemaining = Math.max(0, estimatedMaxParticipants - groupBuy.participants.length);

    const totalSavingsPerUnit = groupBuy.retailPricePerUnit - groupBuy.groupPricePerUnit;

    const daysRemaining = Math.max(0,
        Math.ceil((new Date(groupBuy.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    return {
        percentToTarget,
        percentToMinimum,
        isMinimumMet,
        spotsRemaining,
        totalSavingsPerUnit: Math.round(totalSavingsPerUnit * 100) / 100,
        daysRemaining,
    };
}

/**
 * Calculate savings for a participant
 */
export function calculateParticipantSavings(
    groupBuy: MaterialGroupBuy,
    quantity: number
): {
    retailTotal: number;
    groupTotal: number;
    savings: number;
    savingsPercent: number;
} {
    const retailTotal = groupBuy.retailPricePerUnit * quantity;
    const groupTotal = groupBuy.groupPricePerUnit * quantity;
    const savings = retailTotal - groupTotal;

    return {
        retailTotal: Math.round(retailTotal * 100) / 100,
        groupTotal: Math.round(groupTotal * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent: groupBuy.savingsPercent,
    };
}

/**
 * Common material categories with typical units
 */
export const MATERIAL_CATEGORIES: Record<string, { unit: string; typicalRetailRange: [number, number] }> = {
    'Drywall': { unit: 'sheets', typicalRetailRange: [10, 18] },
    'Lumber 2x4': { unit: 'pieces', typicalRetailRange: [3, 8] },
    'Plywood': { unit: 'sheets', typicalRetailRange: [25, 60] },
    'Concrete': { unit: 'yards', typicalRetailRange: [125, 165] },
    'Rebar': { unit: 'pieces', typicalRetailRange: [5, 12] },
    'Roofing Shingles': { unit: 'bundles', typicalRetailRange: [30, 45] },
    'Insulation': { unit: 'rolls', typicalRetailRange: [15, 35] },
    'Paint': { unit: 'gallons', typicalRetailRange: [25, 60] },
    'Tile': { unit: 'sqft', typicalRetailRange: [2, 12] },
    'Copper Pipe': { unit: 'feet', typicalRetailRange: [2, 6] },
    'PVC Pipe': { unit: 'feet', typicalRetailRange: [0.5, 3] },
    'Electrical Wire': { unit: 'feet', typicalRetailRange: [0.3, 1.5] },
    'Gravel': { unit: 'tons', typicalRetailRange: [30, 50] },
    'Sand': { unit: 'tons', typicalRetailRange: [25, 40] },
    'Mulch': { unit: 'yards', typicalRetailRange: [30, 55] },
};
