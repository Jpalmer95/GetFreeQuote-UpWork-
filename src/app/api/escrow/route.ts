import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import {
    computeEscrowManifestHash,
    computeLedgerReceiptHash,
    signReceiptHash,
    verifyAuditHashChain,
    buildNonCustodialEscrowSpec,
    sha256Hex,
} from '@/services/verifiableEscrow';
import { emitOracleEvent } from '@/services/oracle';

async function loadEscrowWithDetails(escrowRow: Record<string, unknown>) {
    const escrowId = escrowRow.id as string;
    const [{ data: milestones }, { data: receipts }] = await Promise.all([
        supabaseAdmin
            .from('escrow_milestones')
            .select('*')
            .eq('escrow_account_id', escrowId)
            .order('sort_order', { ascending: true }),
        supabaseAdmin
            .from('verifiable_receipts')
            .select('*')
            .eq('escrow_account_id', escrowId)
            .order('seq', { ascending: true }),
    ]);

    const mappedMilestones = (milestones || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        escrowAccountId: m.escrow_account_id as string,
        name: m.name as string,
        amount: Number(m.amount),
        status: m.status as string,
        proofDescription: (m.proof_description as string) || undefined,
        proofPhotos: (m.proof_photos as string[]) || [],
        proofHash: (m.proof_hash as string) || undefined,
        releaseTxHash: (m.release_tx_hash as string) || undefined,
        submittedAt: (m.submitted_at as string) || undefined,
        approvedAt: (m.approved_at as string) || undefined,
        releasedAt: (m.released_at as string) || undefined,
        approvedBy: (m.approved_by as string) || undefined,
    }));

    const chainItems = (receipts || []).map((r: Record<string, unknown>) => ({
        type: r.action_type as string,
        entityId: escrowId,
        amount: Number(r.amount || 0),
        txHash: (r.tx_hash as string) || null,
        prevHash: r.prev_hash as string,
        receiptHash: r.receipt_hash as string,
    }));

    const auditVerification = verifyAuditHashChain(chainItems);
    const spec = buildNonCustodialEscrowSpec({
        jobId: (escrowRow.job_id as string) || null,
        communityProjectId: (escrowRow.community_project_id as string) || null,
        quoteId: (escrowRow.quote_id as string) || null,
        payerId: escrowRow.payer_id as string,
        payeeId: escrowRow.payee_id as string,
        payerWallet: (escrowRow.payer_wallet as string) || null,
        payeeWallet: (escrowRow.payee_wallet as string) || null,
        chainId: Number(escrowRow.chain_id || 8453),
        tokenSymbol: (escrowRow.token_symbol as string) || 'USDC',
        totalAmount: Number(escrowRow.total_amount),
        milestones: mappedMilestones.map(m => ({ name: m.name, amount: m.amount })),
        manifestHash: (escrowRow.manifest_hash as string) || '',
    });

    return {
        id: escrowId,
        jobId: (escrowRow.job_id as string) || '',
        communityProjectId: (escrowRow.community_project_id as string) || undefined,
        quoteId: (escrowRow.quote_id as string) || '',
        payerId: escrowRow.payer_id as string,
        payeeId: escrowRow.payee_id as string,
        payerWallet: (escrowRow.payer_wallet as string) || undefined,
        payeeWallet: (escrowRow.payee_wallet as string) || undefined,
        chainId: Number(escrowRow.chain_id || 8453),
        tokenSymbol: (escrowRow.token_symbol as string) || 'USDC',
        contractAddress: (escrowRow.contract_address as string) || undefined,
        manifestHash: (escrowRow.manifest_hash as string) || '',
        totalAmount: Number(escrowRow.total_amount),
        fundedAmount: Number(escrowRow.funded_amount || 0),
        releasedAmount: Number(escrowRow.released_amount || 0),
        status: escrowRow.status as string,
        milestones: mappedMilestones,
        receipts: receipts || [],
        auditVerification,
        nonCustodialSpec: spec,
        createdAt: escrowRow.created_at as string,
        fundedAt: (escrowRow.funded_at as string) || undefined,
        completedAt: (escrowRow.completed_at as string) || undefined,
    };
}

async function appendReceipt(params: {
    escrowAccountId: string;
    communityProjectId?: string | null;
    jobId?: string | null;
    actionType: string;
    actorId?: string | null;
    amount: number;
    txHash?: string | null;
    payload?: Record<string, unknown>;
}) {
    const { data: existing } = await supabaseAdmin
        .from('verifiable_receipts')
        .select('seq, receipt_hash')
        .eq('escrow_account_id', params.escrowAccountId)
        .order('seq', { ascending: false })
        .limit(1);

    const last = existing && existing.length > 0 ? existing[0] : null;
    const prevHash = (last?.receipt_hash as string) || 'GENESIS';
    const seq = ((last?.seq as number) || 0) + 1;
    const receiptHash = computeLedgerReceiptHash({
        prevHash,
        type: params.actionType,
        entityId: params.escrowAccountId,
        amount: params.amount,
        txHash: params.txHash,
    });
    const signature = signReceiptHash(receiptHash);

    await supabaseAdmin.from('verifiable_receipts').insert({
        escrow_account_id: params.escrowAccountId,
        community_project_id: params.communityProjectId || null,
        job_id: params.jobId || null,
        seq,
        action_type: params.actionType,
        actor_id: params.actorId || null,
        amount: params.amount,
        tx_hash: params.txHash || null,
        payload: params.payload || {},
        prev_hash: prevHash,
        receipt_hash: receiptHash,
        signature,
    });

    return { seq, prevHash, receiptHash, signature };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const escrowId = searchParams.get('id');
        const communityProjectId = searchParams.get('communityProjectId');
        const jobId = searchParams.get('jobId');

        let query = supabaseAdmin.from('escrow_accounts').select('*').order('created_at', { ascending: false });
        if (escrowId) query = query.eq('id', escrowId);
        if (communityProjectId) query = query.eq('community_project_id', communityProjectId);
        if (jobId) query = query.eq('job_id', jobId);

        const { data: rows, error } = await query.limit(25);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

        const detailed = await Promise.all((rows || []).map(r => loadEscrowWithDetails(r as Record<string, unknown>)));
        return NextResponse.json({ success: true, data: detailed });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load escrows';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getAuthenticatedUser(request);
        const body = await request.json();
        const { action, ...params } = body;

        if (action === 'create') {
            if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const totalAmount = Number(params.totalAmount);
            if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                return NextResponse.json({ success: false, error: 'Positive totalAmount required' }, { status: 400 });
            }
            const rawMilestones: { name: string; amount?: number; percentageOfTotal?: number }[] =
                Array.isArray(params.milestones) && params.milestones.length > 0
                    ? params.milestones
                    : [
                          { name: 'Milestone 1: Mobilization & Materials (30%)', amount: Math.round(totalAmount * 0.3) },
                          { name: 'Milestone 2: Core Work & Rough-In (45%)', amount: Math.round(totalAmount * 0.45) },
                          { name: 'Milestone 3: Final Walkthrough & Completion (25%)', amount: totalAmount - Math.round(totalAmount * 0.3) - Math.round(totalAmount * 0.45) },
                      ];

            const normalizedMilestones = rawMilestones.map(m => ({
                name: m.name,
                amount: m.amount != null ? Number(m.amount) : Math.round(totalAmount * ((m.percentageOfTotal || 33.33) / 100)),
            }));

            const chainId = Number(params.chainId || 8453);
            const tokenSymbol = String(params.tokenSymbol || 'USDC');
            const payerId = caller.id;
            const payeeId = String(params.payeeId || caller.id);

            const manifestHash = computeEscrowManifestHash({
                jobId: params.jobId || null,
                communityProjectId: params.communityProjectId || null,
                quoteId: params.quoteId || null,
                payerId,
                payeeId,
                payerWallet: params.payerWallet || null,
                payeeWallet: params.payeeWallet || null,
                chainId,
                tokenSymbol,
                totalAmount,
                milestones: normalizedMilestones,
            });

            const contractAddress = params.contractAddress || `0x8453${manifestHash.slice(0, 36)}`;

            const { data: created, error: createErr } = await supabaseAdmin
                .from('escrow_accounts')
                .insert({
                    job_id: params.jobId || null,
                    community_project_id: params.communityProjectId || null,
                    quote_id: params.quoteId || null,
                    payer_id: payerId,
                    payee_id: payeeId,
                    payer_wallet: params.payerWallet || null,
                    payee_wallet: params.payeeWallet || null,
                    chain_id: chainId,
                    token_symbol: tokenSymbol,
                    contract_address: contractAddress,
                    manifest_hash: manifestHash,
                    total_amount: totalAmount,
                    funded_amount: 0,
                    released_amount: 0,
                    status: 'pending',
                })
                .select()
                .single();

            if (createErr || !created) {
                return NextResponse.json({ success: false, error: createErr?.message || 'Failed to create escrow' }, { status: 500 });
            }

            for (let i = 0; i < normalizedMilestones.length; i++) {
                await supabaseAdmin.from('escrow_milestones').insert({
                    escrow_account_id: created.id,
                    name: normalizedMilestones[i].name,
                    amount: normalizedMilestones[i].amount,
                    status: 'pending',
                    sort_order: i + 1,
                });
            }

            await appendReceipt({
                escrowAccountId: created.id,
                communityProjectId: params.communityProjectId || null,
                jobId: params.jobId || null,
                actionType: 'ESCROW_CREATED',
                actorId: caller.id,
                amount: totalAmount,
                txHash: contractAddress,
                payload: { manifestHash, chainId, tokenSymbol },
            });

            await emitOracleEvent({
                eventType: 'escrow.created',
                entityType: 'escrow_account',
                entityId: created.id,
                payload: { jobId: params.jobId, totalAmount, manifestHash, chainId, tokenSymbol },
            });

            const detail = await loadEscrowWithDetails(created as Record<string, unknown>);
            return NextResponse.json({ success: true, data: detail }, { status: 201 });
        }

        if (action === 'fund') {
            if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const escrowId = String(params.escrowId || params.escrow?.id || '');
            const { data: esc } = await supabaseAdmin.from('escrow_accounts').select('*').eq('id', escrowId).maybeSingle();
            if (!esc) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });

            const amount = Number(params.amount || (Number(esc.total_amount) - Number(esc.funded_amount || 0)));
            const txHash = String(params.txHash || `0x8453${sha256Hex(`${escrowId}:${Date.now()}`).slice(0, 36)}`);
            const newFunded = Number(esc.funded_amount || 0) + amount;
            const isFullyFunded = newFunded >= Number(esc.total_amount);

            const { data: updated, error: updErr } = await supabaseAdmin
                .from('escrow_accounts')
                .update({
                    funded_amount: newFunded,
                    status: isFullyFunded ? 'funded' : 'pending',
                    funded_at: isFullyFunded ? new Date().toISOString() : esc.funded_at,
                    payer_wallet: params.payerWallet || esc.payer_wallet,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', escrowId)
                .select()
                .single();

            if (updErr) return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });

            await appendReceipt({
                escrowAccountId: escrowId,
                communityProjectId: esc.community_project_id,
                jobId: esc.job_id,
                actionType: 'ESCROW_FUNDED',
                actorId: caller.id,
                amount,
                txHash,
                payload: { newFunded, isFullyFunded },
            });

            const detail = await loadEscrowWithDetails(updated as Record<string, unknown>);
            return NextResponse.json({ success: true, data: detail });
        }

        if (action === 'submit_proof') {
            if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const milestoneId = String(params.milestoneId || '');
            const proofDescription = String(params.proofDescription || '').trim();
            const proofPhotos = Array.isArray(params.proofPhotos) ? params.proofPhotos : [];
            if (!milestoneId || !proofDescription) {
                return NextResponse.json({ success: false, error: 'milestoneId and proofDescription required' }, { status: 400 });
            }

            const { data: ms } = await supabaseAdmin.from('escrow_milestones').select('*').eq('id', milestoneId).maybeSingle();
            if (!ms) return NextResponse.json({ success: false, error: 'Milestone not found' }, { status: 404 });

            const proofHash = sha256Hex(`${milestoneId}:${proofDescription}:${proofPhotos.join(',')}`);

            await supabaseAdmin
                .from('escrow_milestones')
                .update({
                    status: 'submitted',
                    proof_description: proofDescription,
                    proof_photos: proofPhotos,
                    proof_hash: proofHash,
                    submitted_at: new Date().toISOString(),
                })
                .eq('id', milestoneId);

            const { data: esc } = await supabaseAdmin.from('escrow_accounts').select('*').eq('id', ms.escrow_account_id).single();

            await appendReceipt({
                escrowAccountId: ms.escrow_account_id,
                communityProjectId: esc?.community_project_id,
                jobId: esc?.job_id,
                actionType: 'MILESTONE_SUBMITTED',
                actorId: caller.id,
                amount: Number(ms.amount),
                txHash: `0xproof_${proofHash.slice(0, 32)}`,
                payload: { milestoneId, milestoneName: ms.name, proofHash, proofDescription },
            });

            const detail = await loadEscrowWithDetails(esc as Record<string, unknown>);
            return NextResponse.json({ success: true, data: detail });
        }

        if (action === 'approve_milestone') {
            if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const milestoneId = String(params.milestoneId || '');
            const { data: ms } = await supabaseAdmin.from('escrow_milestones').select('*').eq('id', milestoneId).maybeSingle();
            if (!ms) return NextResponse.json({ success: false, error: 'Milestone not found' }, { status: 404 });

            const { data: esc } = await supabaseAdmin.from('escrow_accounts').select('*').eq('id', ms.escrow_account_id).maybeSingle();
            if (!esc) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });

            const now = new Date().toISOString();
            const releaseTxHash = String(params.releaseTxHash || `0x8453${sha256Hex(`release:${milestoneId}:${now}`).slice(0, 36)}`);

            await supabaseAdmin
                .from('escrow_milestones')
                .update({
                    status: 'released',
                    release_tx_hash: releaseTxHash,
                    approved_at: now,
                    released_at: now,
                    approved_by: caller.id,
                })
                .eq('id', milestoneId);

            const { data: allMs } = await supabaseAdmin
                .from('escrow_milestones')
                .select('status, amount')
                .eq('escrow_account_id', esc.id);

            const totalReleased = (allMs || [])
                .filter((m: Record<string, unknown>) => m.status === 'released')
                .reduce((sum: number, m: Record<string, unknown>) => sum + Number(m.amount), 0);
            const allReleased = (allMs || []).every((m: Record<string, unknown>) => m.status === 'released');

            const { data: updatedEsc } = await supabaseAdmin
                .from('escrow_accounts')
                .update({
                    released_amount: totalReleased,
                    status: allReleased ? 'released' : 'partial_released',
                    completed_at: allReleased ? now : null,
                    updated_at: now,
                })
                .eq('id', esc.id)
                .select()
                .single();

            await appendReceipt({
                escrowAccountId: esc.id,
                communityProjectId: esc.community_project_id,
                jobId: esc.job_id,
                actionType: 'MILESTONE_RELEASED',
                actorId: caller.id,
                amount: Number(ms.amount),
                txHash: releaseTxHash,
                payload: { milestoneId, milestoneName: ms.name, releaseTxHash },
            });

            if (esc.community_project_id) {
                try {
                    await supabaseAdmin.rpc('record_community_expense', {
                        p_project_id: esc.community_project_id,
                        p_creator_id: esc.payer_id,
                        p_amount: Number(ms.amount),
                        p_description: `Escrow Milestone Released: ${ms.name} (TX: ${releaseTxHash.slice(0, 14)}...)`,
                    });
                } catch {
                    // Best-effort ledger sync if creator differs
                }
            }

            await emitOracleEvent({
                eventType: 'escrow.milestone_released',
                entityType: 'escrow_milestone',
                entityId: milestoneId,
                payload: { escrowId: esc.id, amount: Number(ms.amount), releaseTxHash },
            });

            const detail = await loadEscrowWithDetails((updatedEsc || esc) as Record<string, unknown>);
            return NextResponse.json({ success: true, data: detail });
        }

        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Escrow operation failed';
        return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
}
