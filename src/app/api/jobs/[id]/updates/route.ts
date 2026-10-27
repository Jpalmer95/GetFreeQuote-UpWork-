import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { redistributeToOpenThreads } from '@/services/bidDesk';
import { dispatchNotification } from '@/services/notificationDispatcher';

/**
 * GET  /api/jobs/[id]/updates  → public. The job's clarification log, oldest → newest.
 * POST /api/jobs/[id]/updates  → owner only. Appends an update, then:
 *   1. fans the text out to every open bid thread (email/SMS/native/voice), and
 *   2. notifies every vendor who already quoted so nobody prices a stale brief.
 *
 * Body: { body: string, kind?: 'clarification'|'scope_change'|'schedule'|'media'|'status',
 *         attachments?: string[] }
 */

const KINDS = new Set(['clarification', 'scope_change', 'schedule', 'media', 'status']);

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const { data, error } = await supabaseAdmin
        .from('job_updates')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Sign in to post an update.' }, { status: 401 });

    let payload: { body?: unknown; kind?: unknown; attachments?: unknown };
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (body.length < 4) {
        return NextResponse.json({ error: 'Write at least a few words of detail.' }, { status: 400 });
    }
    if (body.length > 4000) {
        return NextResponse.json({ error: 'Keep updates under 4000 characters.' }, { status: 400 });
    }
    const kind = typeof payload.kind === 'string' && KINDS.has(payload.kind) ? payload.kind : 'clarification';
    const attachments = Array.isArray(payload.attachments)
        ? payload.attachments.filter((u): u is string => typeof u === 'string').slice(0, 10)
        : [];

    const { data: job } = await supabaseAdmin
        .from('jobs')
        .select('id, user_id, title, location')
        .eq('id', id)
        .maybeSingle();
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    if (job.user_id !== caller.id) {
        return NextResponse.json({ error: 'Only the job owner can post updates.' }, { status: 403 });
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', caller.id)
        .maybeSingle();

    const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('job_updates')
        .insert({
            job_id: id,
            author_id: caller.id,
            author_name: profile?.full_name || 'Job owner',
            kind,
            body,
            attachments,
        })
        .select()
        .single();
    if (insertErr) {
        // The table ships as a migration; make the failure actionable instead of silent.
        const hint = /relation .* does not exist/i.test(insertErr.message)
            ? 'The job_updates table is missing — apply supabase_migrations/JOB_UPDATES.sql.'
            : insertErr.message;
        return NextResponse.json({ error: hint }, { status: 500 });
    }

    // Fan the change out to the bid threads that use a delivery channel.
    let dispatched = 0;
    try {
        const results = await redistributeToOpenThreads(id, {
            sender: profile?.full_name || 'Job owner',
            body: `Job brief updated: ${body}`,
        });
        dispatched = results.filter(r => r.ok).length;
    } catch (err) {
        console.error('[jobUpdates] redistribute failed:', err);
    }

    // Notify vendors who already quoted — a quote is priced against a brief revision.
    try {
        const { data: quotes } = await supabaseAdmin
            .from('quotes')
            .select('vendor_id')
            .eq('job_id', id);
        const vendorIds: string[] = Array.from(
            new Set(((quotes || []) as { vendor_id: string }[]).map(q => q.vendor_id)),
        );
        for (const vendorId of vendorIds) {
            await dispatchNotification({
                userId: vendorId,
                type: 'job_match',
                title: 'Job brief updated',
                message: `${job.title} changed: ${body.slice(0, 140)}`,
                jobId: id,
                priority: 'high',
                actionRequired: false,
                actionUrl: `/jobs/${id}`,
            });
        }
    } catch (err) {
        console.error('[jobUpdates] notify failed:', err);
    }

    await supabaseAdmin.from('agent_actions').insert({
        job_id: id,
        user_id: caller.id,
        action_type: 'job_update',
        summary: `Posted a ${kind} to the job brief (${dispatched} thread(s) reached)`,
        details: { body, kind, attachments },
        automated: false,
    });

    return NextResponse.json({ success: true, data: inserted, dispatched });
}
