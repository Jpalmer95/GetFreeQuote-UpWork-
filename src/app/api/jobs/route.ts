import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitOracleEvent } from '@/services/oracle';

export async function POST(request: NextRequest) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    if (!title || !description) {
        return NextResponse.json({ error: 'title and description required' }, { status: 400 });
    }

    const { data: job, error } = await supabaseAdmin
        .from('jobs')
        .insert({
            user_id: caller.id,
            title,
            category: body.category || 'Other',
            description,
            location,
            tags: Array.isArray(body.tags) ? body.tags : [],
            is_public: body.isPublic !== false,
            requires_permit: !!body.requiresPermit,
            budget: body.budget || null,
            industry_vertical: body.industryVertical || 'Home Services',
            subcategory: body.subcategory || 'Other',
            urgency: body.urgency || 'flexible',
            square_footage: body.squareFootage || null,
            materials: body.materials || null,
            is_local_request: !!body.isLocalRequest,
            location_lat: body.lat ?? null,
            location_lng: body.lng ?? null,
            radius_miles: body.radiusMiles ?? 25,
            status: 'OPEN',
        })
        .select()
        .single();

    if (error || !job) {
        return NextResponse.json({ error: error?.message || 'Failed to create job' }, { status: 500 });
    }

    await emitOracleEvent({
        eventType: 'job.created',
        entityType: 'job',
        entityId: job.id,
        payload: { title, location, industry: job.industry_vertical },
    });

    // Fire-and-forget matching / Job Brief generation.
    fetch(new URL('/api/agent-process', request.url), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: request.headers.get('authorization') || '',
        },
        body: JSON.stringify({ jobId: job.id }),
    }).catch(() => {});

    return NextResponse.json({ success: true, job }, { status: 201 });
}
