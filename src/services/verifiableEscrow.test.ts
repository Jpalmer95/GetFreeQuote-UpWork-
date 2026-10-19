import { describe, it, expect } from 'vitest';
import {
    computeEscrowManifestHash,
    computeLedgerReceiptHash,
    verifyAuditHashChain,
    buildNonCustodialEscrowSpec,
} from './verifiableEscrow';

describe('verifiableEscrow (Pattern 2 non-custodial audit chain)', () => {
    it('computes a deterministic manifest hash and changes if milestone amounts change', () => {
        const base = {
            jobId: 'job-1',
            payerId: 'u1',
            payeeId: 'v1',
            payerWallet: '0xAAA',
            payeeWallet: '0xBBB',
            chainId: 8453,
            tokenSymbol: 'USDC',
            totalAmount: 5000,
            milestones: [
                { name: 'Rough-in', amount: 2500 },
                { name: 'Final', amount: 2500 },
            ],
        };
        const h1 = computeEscrowManifestHash(base);
        const h2 = computeEscrowManifestHash({ ...base });
        const tampered = computeEscrowManifestHash({
            ...base,
            milestones: [
                { name: 'Rough-in', amount: 3000 },
                { name: 'Final', amount: 2000 },
            ],
        });
        expect(h1).toBe(h2);
        expect(h1).not.toBe(tampered);
    });

    it('verifies a valid hash chain and detects tampering', () => {
        const r1 = computeLedgerReceiptHash({
            prevHash: 'GENESIS',
            type: 'DONATION',
            entityId: 'proj-1',
            amount: 7500,
            txHash: '0xabc',
        });
        const r2 = computeLedgerReceiptHash({
            prevHash: r1,
            type: 'EXPENSE',
            entityId: 'proj-1',
            amount: 2760,
            txHash: '0xdef',
        });

        const validResult = verifyAuditHashChain([
            { type: 'DONATION', entityId: 'proj-1', amount: 7500, txHash: '0xabc', prevHash: 'GENESIS', receiptHash: r1 },
            { type: 'EXPENSE', entityId: 'proj-1', amount: 2760, txHash: '0xdef', prevHash: r1, receiptHash: r2 },
        ]);
        expect(validResult.valid).toBe(true);
        expect(validResult.checkedCount).toBe(2);
        expect(validResult.headHash).toBe(r2);

        const tamperedResult = verifyAuditHashChain([
            { type: 'DONATION', entityId: 'proj-1', amount: 7500, txHash: '0xabc', prevHash: 'GENESIS', receiptHash: r1 },
            { type: 'EXPENSE', entityId: 'proj-1', amount: 9999, txHash: '0xdef', prevHash: r1, receiptHash: r2 },
        ]);
        expect(tamperedResult.valid).toBe(false);
        expect(tamperedResult.brokenAtIndex).toBe(1);
    });

    it('builds a non-custodial escrow spec with Base Mainnet metadata', () => {
        const spec = buildNonCustodialEscrowSpec({
            payerId: 'u1',
            payeeId: 'v1',
            chainId: 8453,
            tokenSymbol: 'USDC',
            totalAmount: 1000,
            milestones: [{ name: 'M1', amount: 1000 }],
            manifestHash: 'deadbeef',
        });
        expect(spec.custodyModel).toBe('NON_CUSTODIAL_DIRECT');
        expect(spec.chainName).toBe('Base Mainnet');
    });
});
