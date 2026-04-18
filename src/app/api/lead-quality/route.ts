import { NextResponse } from 'next/server';
import { calculateLeadQuality } from '@/services/leadQuality';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const score = calculateLeadQuality(body);
        return NextResponse.json({ success: true, data: score });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
