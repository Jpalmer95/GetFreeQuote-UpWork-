import { NextResponse } from 'next/server';
import { parseScope } from '@/services/scopeBreakdown';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const scope = parseScope(body);
        return NextResponse.json({ success: true, data: scope });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
