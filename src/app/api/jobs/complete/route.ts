import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { completeAwardedJob } from '@/services/awardService';

export async function POST(request: NextRequest) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const jobId = body.jobId as string | undefined;
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const result = await completeAwardedJob({ jobId, ownerId: caller.id });
    if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Failed to complete job' }, { status: result.status || 500 });
    }
    return NextResponse.json({ status: 'ok', newStatus: 'COMPLETED' });
}
