import { NextResponse } from 'next/server';
import { createGroupBuy, joinGroupBuy, leaveGroupBuy, getGroupBuyProgress } from '@/services/materialGroupBuy';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'create': {
                const buy = createGroupBuy(params.organizerId, params.materialCategory, params.materialDescription, params.retailPricePerUnit, params.minimumQuantity, params.targetQuantity, params.deadlineDays, params.deliveryLocation);
                return NextResponse.json({ success: true, data: buy });
            }
            case 'join': {
                const { groupBuy, participant, error } = joinGroupBuy(params.groupBuy, params.vendorId, params.vendorName, params.quantity);
                if (error) return NextResponse.json({ success: false, error }, { status: 400 });
                return NextResponse.json({ success: true, data: { groupBuy, participant } });
            }
            case 'leave': {
                const { groupBuy, error } = leaveGroupBuy(params.groupBuy, params.vendorId);
                if (error) return NextResponse.json({ success: false, error }, { status: 400 });
                return NextResponse.json({ success: true, data: groupBuy });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
