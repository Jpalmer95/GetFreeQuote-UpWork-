import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitOracleEvent } from '@/services/oracle';
import { canCancelJobStatus, jobPatchFromBody } from '@/lib/jobUpdates';

async function loadOwnedJob(jobId: string, ownerId: string) {
    const { data: job, error } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
    if (error) return { error: error.message, status: 500 as const, job: null };
    if (!job) return { error: 'Job not found', status: 404 as const, job: null };
    if (job.user_id !== ownerId) return { error: 'Forbidden', status: 403 as const, job: null };
    return { error: null, status: 200 as const, job };
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const owned = await loadOwnedJob(id, caller.id);
    if (!owned.job) return NextResponse.json({ error: owned.error }, { status: owned.status });

    if (owned.job.status === 'COMPLETED' || owned.job.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Closed jobs cannot be edited' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const patchInput = { ...(body as Record<string, unknown>) };
    if (patchInput.workKind && !Array.isArray(patchInput.tags)) {
        patchInput.tags = owned.job.tags || [];
    }
    const patch = jobPatchFromBody(patchInput);
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'No allowed fields to update' }, { status: 400 });
    }

    const { data: job, error } = await supabaseAdmin
        .from('jobs')
        .update(patch)
        .eq('id', id)
        .eq('user_id', caller.id)
        .select()
        .single();

    if (error || !job) {
        return NextResponse.json({ error: error?.message || 'Failed to update job' }, { status: 500 });
    }

    await emitOracleEvent({
        eventType: 'job.updated',
        entityType: 'job',
        entityId: job.id,
        payload: { fields: Object.keys(patch) },
    });

    return NextResponse.json({ success: true, job });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const owned = await loadOwnedJob(id, caller.id);
    if (!owned.job) return NextResponse.json({ error: owned.error }, { status: owned.status });

    if (!canCancelJobStatus(owned.job.status)) {
        return NextResponse.json(
            { error: 'In-progress or completed jobs cannot be cancelled. Mark complete instead.' },
            { status: 409 },
        );
    }

    const { data: job, error } = await supabaseAdmin
        .from('jobs')
        .update({ status: 'CANCELLED', is_public: false })
        .eq('id', id)
        .eq('user_id', caller.id)
        .select()
        .single();

    if (error || !job) {
        return NextResponse.json({ error: error?.message || 'Failed to cancel job' }, { status: 500 });
    }

    await emitOracleEvent({
        eventType: 'job.cancelled',
        entityType: 'job',
        entityId: job.id,
        payload: { title: job.title },
    });

    return NextResponse.json({ success: true, job });
}
