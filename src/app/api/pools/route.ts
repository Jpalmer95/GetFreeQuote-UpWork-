import { NextResponse } from 'next/server';
import { createNeighborhoodPool, joinPool, leavePool, findNearbyPools } from '@/services/neighborhoodPool';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'create': {
                const pool = createNeighborhoodPool(params);
                return NextResponse.json({ success: true, data: pool });
            }
            case 'join': {
                const { pool, participant, error } = joinPool(params.pool, params.userId, params.userName, params.address, params.addressLat, params.addressLng, params.specialRequests);
                if (error) return NextResponse.json({ success: false, error }, { status: 400 });
                return NextResponse.json({ success: true, data: { pool, participant } });
            }
            case 'leave': {
                const { pool, error } = leavePool(params.pool, params.userId);
                if (error) return NextResponse.json({ success: false, error }, { status: 400 });
                return NextResponse.json({ success: true, data: pool });
            }
            case 'nearby': {
                const nearby = findNearbyPools(params.userLat, params.userLng, params.pools, params.maxDistance);
                return NextResponse.json({ success: true, data: nearby });
            }
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
