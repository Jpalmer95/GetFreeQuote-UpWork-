import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { mapJobRow, JobRow } from '@/services/serverMappers';

export async function POST(req: NextRequest): Promise<NextResponse> {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { jobId?: string };
    const { jobId } = body;
    if (!jobId) {
        return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const { data: jobRow, error: fetchError } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (fetchError || !jobRow) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = mapJobRow(jobRow as JobRow & { last_reminded_at: string | null });

    if (job.userId !== caller.id) {
        return NextResponse.json({ error: 'Forbidden: not the job owner' }, { status: 403 });
    }

    if (job.status !== 'EXPIRED') {
        return NextResponse.json({ error: 'Only expired jobs can be reposted' }, { status: 400 });
    }

    const { data: newJob, error: insertError } = await supabaseAdmin
        .from('jobs')
        .insert({
            user_id: job.userId,
            title: job.title,
            category: job.category,
            description: job.description,
            location: job.location,
            tags: job.tags,
            is_public: job.isPublic,
            requires_permit: job.requiresPermit,
            budget: job.budget || null,
            industry_vertical: job.industryVertical,
            subcategory: job.subcategory,
            urgency: job.urgency || 'flexible',
            square_footage: job.squareFootage || null,
            materials: job.materials || null,
            attachments: job.attachments || [],
            timeline_start: job.timelineStart || null,
            timeline_end: job.timelineEnd || null,
            community_project_id: job.communityProjectId || null,
            status: 'OPEN',
        })
        .select()
        .single();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ jobId: newJob.id });
}
