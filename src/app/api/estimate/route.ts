import { NextResponse } from 'next/server';
import { estimatePrice, getPriceConfidenceLabel } from '@/services/priceEstimation';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const estimate = estimatePrice(body);
        const confidence = getPriceConfidenceLabel(estimate.confidence);
        return NextResponse.json({ success: true, data: { ...estimate, confidenceLabel: confidence } });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
