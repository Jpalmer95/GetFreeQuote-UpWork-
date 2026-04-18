/**
 * Escrow & Payment Protection Service
 * 
 * Manages escrow accounts, milestone releases, and dispute resolution.
 */

import {
    EscrowAccount,
    EscrowMilestone,
    EscrowStatus,
    Dispute,
    PaymentRecord,
    FactoringRequest,
    QuoteMilestone,
    PaymentTerms,
} from '@/types';

// Platform fee constants
const PLATFORM_FEE_PERCENT = 2.9;     // standard payment processing
const FACTORING_FEE_PERCENT = 3.5;    // early payment fee
const ESCROW_HOLD_DAYS = 7;           // auto-release after N days if no dispute

/**
 * Create an escrow account from a quote's payment terms
 */
export function createEscrowAccount(
    jobId: string,
    quoteId: string,
    payerId: string,
    payeeId: string,
    totalAmount: number,
    milestones: QuoteMilestone[]
): EscrowAccount {
    const escrowMilestones: EscrowMilestone[] = milestones.map((m, i) => ({
        id: `escrow_m_${Date.now()}_${i}`,
        escrowAccountId: '', // set after creation
        name: m.name,
        amount: Math.round(totalAmount * (m.percentageOfTotal / 100)),
        status: 'pending' as const,
    }));

    return {
        id: `escrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobId,
        quoteId,
        payerId,
        payeeId,
        totalAmount,
        fundedAmount: 0,
        releasedAmount: 0,
        status: 'pending',
        milestones: escrowMilestones,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Fund the escrow account (user deposits payment)
 */
export function fundEscrow(
    escrow: EscrowAccount,
    amount: number
): { escrow: EscrowAccount; payment: PaymentRecord } {
    const newFundedAmount = escrow.fundedAmount + amount;
    const isFullyFunded = newFundedAmount >= escrow.totalAmount;

    const payment: PaymentRecord = {
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobId: escrow.jobId,
        escrowAccountId: escrow.id,
        fromUserId: escrow.payerId,
        toUserId: escrow.payeeId,
        amount,
        fee: Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100,
        netAmount: amount,
        provider: 'platform_escrow',
        status: 'completed',
        type: 'deposit',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
    };

    return {
        escrow: {
            ...escrow,
            fundedAmount: newFundedAmount,
            status: isFullyFunded ? 'funded' : 'pending',
            fundedAt: isFullyFunded ? new Date().toISOString() : undefined,
        },
        payment,
    };
}

/**
 * Submit milestone completion proof
 */
export function submitMilestoneProof(
    escrow: EscrowAccount,
    milestoneId: string,
    proofDescription: string,
    proofPhotos: string[]
): EscrowAccount {
    return {
        ...escrow,
        milestones: escrow.milestones.map(m =>
            m.id === milestoneId
                ? {
                    ...m,
                    status: 'submitted' as const,
                    proofDescription,
                    proofPhotos,
                    submittedAt: new Date().toISOString(),
                }
                : m
        ),
    };
}

/**
 * Approve a completed milestone (releases funds)
 */
export function approveMilestone(
    escrow: EscrowAccount,
    milestoneId: string,
    approverId: string
): { escrow: EscrowAccount; payment: PaymentRecord | null } {
    const milestone = escrow.milestones.find(m => m.id === milestoneId);
    if (!milestone || milestone.status !== 'submitted') {
        return { escrow, payment: null };
    }

    const now = new Date().toISOString();
    const updatedMilestones = escrow.milestones.map(m =>
        m.id === milestoneId
            ? { ...m, status: 'approved' as const, approvedAt: now, approvedBy: approverId }
            : m
    );

    const releasedAmount = escrow.releasedAmount + milestone.amount;
    const allReleased = updatedMilestones.every(m => m.status === 'released' || m.status === 'approved');

    // Create payment for this milestone release
    const payment: PaymentRecord = {
        id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jobId: escrow.jobId,
        escrowAccountId: escrow.id,
        fromUserId: escrow.payerId,
        toUserId: escrow.payeeId,
        amount: milestone.amount,
        fee: Math.round(milestone.amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100,
        netAmount: milestone.amount - Math.round(milestone.amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100,
        provider: 'platform_escrow',
        status: 'completed',
        type: 'milestone_release',
        createdAt: now,
        completedAt: now,
    };

    return {
        escrow: {
            ...escrow,
            milestones: updatedMilestones.map(m =>
                m.id === milestoneId
                    ? { ...m, status: 'released' as const, releasedAt: now }
                    : m
            ),
            releasedAmount,
            status: allReleased ? 'released' : 'partial_released',
            completedAt: allReleased ? now : undefined,
        },
        payment,
    };
}

/**
 * File a dispute on an escrow account
 */
export function fileDispute(
    escrow: EscrowAccount,
    filedBy: string,
    reason: string,
    description: string,
    evidencePhotos: string[]
): { escrow: EscrowAccount; dispute: Dispute } {
    const dispute: Dispute = {
        id: `dispute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        escrowAccountId: escrow.id,
        jobId: escrow.jobId,
        filedBy,
        filedAgainst: filedBy === escrow.payerId ? escrow.payeeId : escrow.payerId,
        reason,
        description,
        evidencePhotos,
        status: 'open',
        createdAt: new Date().toISOString(),
    };

    // Freeze all pending milestones
    const frozenMilestones = escrow.milestones.map(m =>
        m.status === 'pending' || m.status === 'submitted'
            ? { ...m, status: 'disputed' as const }
            : m
    );

    return {
        escrow: {
            ...escrow,
            status: 'disputed',
            disputeId: dispute.id,
            milestones: frozenMilestones,
        },
        dispute,
    };
}

/**
 * Resolve a dispute
 */
export function resolveDispute(
    dispute: Dispute,
    resolution: string,
    resolutionAmount: number,
    resolvedBy: string
): Dispute {
    return {
        ...dispute,
        status: 'resolved',
        resolution,
        resolutionAmount,
        resolvedAt: new Date().toISOString(),
        resolvedBy,
    };
}

/**
 * Request factoring (early payment)
 */
export function requestFactoring(
    escrow: EscrowAccount,
    vendorId: string
): FactoringRequest {
    const unreleasedAmount = escrow.fundedAmount - escrow.releasedAmount;
    const feeAmount = Math.round(unreleasedAmount * (FACTORING_FEE_PERCENT / 100) * 100) / 100;
    const advanceAmount = unreleasedAmount - feeAmount;

    return {
        id: `factor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        vendorId,
        jobId: escrow.jobId,
        escrowAccountId: escrow.id,
        originalAmount: unreleasedAmount,
        advanceAmount,
        feeAmount,
        feePercent: FACTORING_FEE_PERCENT,
        status: 'requested',
        requestedAt: new Date().toISOString(),
    };
}

/**
 * Check for auto-release (funds held too long without dispute)
 */
export function checkAutoRelease(escrow: EscrowAccount): EscrowAccount {
    if (escrow.status !== 'funded' && escrow.status !== 'partial_released') {
        return escrow;
    }

    const fundedAt = escrow.fundedAt ? new Date(escrow.fundedAt) : new Date(escrow.createdAt);
    const daysSinceFunded = (Date.now() - fundedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceFunded >= ESCROW_HOLD_DAYS) {
        // Auto-release remaining milestones
        const now = new Date().toISOString();
        const totalReleased = escrow.milestones.reduce((sum, m) =>
            sum + (m.status === 'released' ? m.amount : 0), 0
        );
        const remaining = escrow.fundedAmount - totalReleased;

        return {
            ...escrow,
            milestones: escrow.milestones.map(m =>
                m.status !== 'released'
                    ? { ...m, status: 'released' as const, releasedAt: now }
                    : m
            ),
            releasedAmount: escrow.fundedAmount,
            status: 'released',
            completedAt: now,
        };
    }

    return escrow;
}

/**
 * Get escrow summary for display
 */
export function getEscrowSummary(escrow: EscrowAccount): {
    percentFunded: number;
    percentReleased: number;
    nextMilestone: EscrowMilestone | null;
    totalMilestones: number;
    completedMilestones: number;
} {
    const percentFunded = escrow.totalAmount > 0
        ? Math.round((escrow.fundedAmount / escrow.totalAmount) * 100)
        : 0;
    const percentReleased = escrow.fundedAmount > 0
        ? Math.round((escrow.releasedAmount / escrow.fundedAmount) * 100)
        : 0;

    const nextMilestone = escrow.milestones.find(
        m => m.status === 'pending' || m.status === 'submitted'
    ) || null;

    const completedMilestones = escrow.milestones.filter(
        m => m.status === 'released'
    ).length;

    return {
        percentFunded,
        percentReleased,
        nextMilestone,
        totalMilestones: escrow.milestones.length,
        completedMilestones,
    };
}
