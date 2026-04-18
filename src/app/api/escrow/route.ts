import { NextResponse } from 'next/server';
import { createEscrowAccount, fundEscrow, approveMilestone, fileDispute, getEscrowSummary } from '@/services/escrow';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'create': {
                const escrow = createEscrowAccount(params.jobId, params.quoteId, params.payerId, params.payeeId, params.totalAmount, params.milestones);
                return NextResponse.json({ success: true, data: escrow });
            }
            case 'fund': {
                const { escrow, payment } = fundEscrow(params.escrow, params.amount);
                return NextResponse.json({ success: true, data: { escrow, payment } });
            }
            case 'approve_milestone': {
                const { escrow, payment } = approveMilestone(params.escrow, params.milestoneId, params.approverId);
                return NextResponse.json({ success: true, data: { escrow, payment } });
            }
            case 'dispute': {
                const { escrow, dispute } = fileDispute(params.escrow, params.filedBy, params.reason, params.description, params.evidencePhotos);
                return NextResponse.json({ success: true, data: { escrow, dispute } });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
