import { NextResponse } from 'next/server';
import { calculateSurge, applySurgePrice, getSurgeExplanation, predictSurgeWindows } from '@/services/surgePricing';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const surge = calculateSurge(body);
        return NextResponse.json({ success: true, data: surge });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as any;
    const predictions = predictSurgeWindows(category || 'gig_work');
    return NextResponse.json({ success: true, data: predictions });
}
