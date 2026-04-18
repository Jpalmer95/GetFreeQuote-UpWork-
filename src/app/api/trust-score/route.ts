import { NextResponse } from 'next/server';
import { calculateTrustScore } from '@/services/trustScore';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const score = calculateTrustScore(body);
        return NextResponse.json({ success: true, data: score });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    // In production: fetch from database
    return NextResponse.json({ success: true, vendorId });
}
