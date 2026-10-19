/**
 * Pattern 2: Non-Custodial Verifiable Milestone Escrow & Hash-Chained Audit Ledger
 *
 * Zero-liability architecture for an open-source marketplace:
 *  1. Platform NEVER holds custody of funds or private keys.
 *  2. Every escrow agreement produces a canonical SHA-256 `manifestHash` and an
 *     EIP-712 / SmartInvoice-compatible non-custodial escrow spec (chainId, token,
 *     payerWallet, payeeWallet, milestone amounts) that parties fund & release
 *     directly wallet-to-contract or wallet-to-wallet.
 *  3. Every state transition (deposit tx, milestone proof submission, milestone
 *     approval & release tx, community donation/expense) is recorded in a
 *     SHA-256 hash-chained audit log (`prev_hash` -> `receipt_hash`) that any
 *     donor, homeowner, contractor, or agent can deterministically verify.
 */

import { createHash, createHmac } from 'crypto';

export interface EscrowManifestInput {
    jobId?: string | null;
    communityProjectId?: string | null;
    quoteId?: string | null;
    payerId: string;
    payeeId: string;
    payerWallet?: string | null;
    payeeWallet?: string | null;
    chainId: number;
    tokenSymbol: string;
    totalAmount: number;
    milestones: { name: string; amount: number }[];
}

export interface AuditChainItem {
    type: string;
    entityId: string;
    amount: number;
    txHash?: string | null;
    prevHash: string;
    receiptHash: string;
}

export function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

export function computeEscrowManifestHash(input: EscrowManifestInput): string {
    const canonical = JSON.stringify({
        jobId: input.jobId || null,
        communityProjectId: input.communityProjectId || null,
        quoteId: input.quoteId || null,
        payerId: input.payerId,
        payeeId: input.payeeId,
        payerWallet: (input.payerWallet || '').toLowerCase(),
        payeeWallet: (input.payeeWallet || '').toLowerCase(),
        chainId: input.chainId,
        tokenSymbol: input.tokenSymbol.toUpperCase(),
        totalAmount: Number(input.totalAmount),
        milestones: input.milestones.map(m => ({
            name: m.name.trim(),
            amount: Number(m.amount),
        })),
    });
    return sha256Hex(canonical);
}

export function computeLedgerReceiptHash(params: {
    prevHash: string;
    type: string;
    entityId: string;
    amount: number;
    txHash?: string | null;
}): string {
    const prev = params.prevHash || 'GENESIS';
    const canonical = `${prev}:${params.type}:${params.entityId}:${params.amount}:${params.txHash || ''}`;
    return sha256Hex(canonical);
}

export function signReceiptHash(receiptHash: string): string {
    const secret = process.env.ORACLE_SIGNING_SECRET || 'gfq-verifiable-audit-key';
    return createHmac('sha256', secret).update(receiptHash).digest('hex');
}

export function verifyAuditHashChain(entries: AuditChainItem[]): {
    valid: boolean;
    checkedCount: number;
    headHash: string;
    brokenAtIndex?: number;
    expectedHash?: string;
    actualHash?: string;
} {
    let expectedPrev = 'GENESIS';
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.prevHash !== expectedPrev) {
            return {
                valid: false,
                checkedCount: i,
                headHash: expectedPrev,
                brokenAtIndex: i,
                expectedHash: expectedPrev,
                actualHash: e.prevHash,
            };
        }
        const recomputed = computeLedgerReceiptHash({
            prevHash: e.prevHash,
            type: e.type,
            entityId: e.entityId,
            amount: Number(e.amount),
            txHash: e.txHash,
        });
        if (recomputed !== e.receiptHash) {
            return {
                valid: false,
                checkedCount: i,
                headHash: expectedPrev,
                brokenAtIndex: i,
                expectedHash: recomputed,
                actualHash: e.receiptHash,
            };
        }
        expectedPrev = e.receiptHash;
    }
    return {
        valid: true,
        checkedCount: entries.length,
        headHash: expectedPrev,
    };
}

export function buildNonCustodialEscrowSpec(input: EscrowManifestInput & { manifestHash: string }) {
    const chainNames: Record<number, { name: string; explorer: string }> = {
        8453: { name: 'Base Mainnet', explorer: 'https://basescan.org/tx/' },
        84532: { name: 'Base Sepolia', explorer: 'https://sepolia.basescan.org/tx/' },
        42161: { name: 'Arbitrum One', explorer: 'https://arbiscan.io/tx/' },
        137: { name: 'Polygon POS', explorer: 'https://polygonscan.com/tx/' },
        1: { name: 'Ethereum Mainnet', explorer: 'https://etherscan.io/tx/' },
    };
    const chain = chainNames[input.chainId] || { name: `Chain ${input.chainId}`, explorer: 'https://basescan.org/tx/' };
    return {
        protocol: 'GetFreeQuote-NonCustodial-MilestoneEscrow-v1',
        custodyModel: 'NON_CUSTODIAL_DIRECT',
        platformLiability: 'NONE (Payer & Payee settle directly via on-chain contract or direct transfer with hash-chained proof)',
        chainId: input.chainId,
        chainName: chain.name,
        explorerTxPrefix: chain.explorer,
        tokenSymbol: input.tokenSymbol,
        manifestHash: input.manifestHash,
        payerWallet: input.payerWallet || '0x0000000000000000000000000000000000000000',
        payeeWallet: input.payeeWallet || '0x0000000000000000000000000000000000000000',
        totalAmount: input.totalAmount,
        milestones: input.milestones,
    };
}
