import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { dispatchNotification } from '@/services/notificationDispatcher';
import { getOrCreateThread, addBidMessage, setRankedQuote } from '@/services/bidDesk';
import { emitOracleEvent } from '@/services/oracle';

/**
 * POST /api/quotes — vendor (or their agent via session) submits a quote on an OPEN job.
 * GET  /api/quotes?jobId= — quotes visible to the job owner or the quoting vendor.
 */
export async function GET(request: NextRequest) {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobId = new URL(request.url).searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const { data: job } = await supabaseAdmin.from('jobs').select('id, user_id').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    let query = supabaseAdmin.from('quotes').select('*').eq('job_id', jobId).order('created_at', { ascending: false });
    if (job.user_id !== caller.id) query = query.eq('vendor_id', caller.id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest) {
    try {
        const caller = await getAuthenticatedUser(request);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const jobId = body.jobId as string | undefined;
        const amount = Number(body.amount);
        const estimatedDays = Math.max(1, Number(body.estimatedDays) || 1);
        const details = typeof body.details === 'string' ? body.details.trim() : '';

        if (!jobId || !Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'jobId and a positive amount are required' }, { status: 400 });
        }
        if (!details) return NextResponse.json({ error: 'details is required' }, { status: 400 });

        const { data: job, error: jobErr } = await supabaseAdmin
            .from('jobs')
            .select('id, user_id, status, is_public, title')
            .eq('id', jobId)
            .maybeSingle();
        if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
        if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        if (job.user_id === caller.id) return NextResponse.json({ error: 'You cannot quote on your own job' }, { status: 403 });
        if (job.status !== 'OPEN') return NextResponse.json({ error: `Job is ${job.status} and not accepting quotes` }, { status: 400 });
        if (!job.is_public) return NextResponse.json({ error: 'Job is not public' }, { status: 403 });

        const { data: existing } = await supabaseAdmin
            .from('quotes')
            .select('id')
            .eq('job_id', jobId)
            .eq('vendor_id', caller.id)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ error: 'You already quoted this job. Use the vendor dashboard to revise it.' }, { status: 409 });
        }

        const { data: profile } = await supabaseAdmin
            .from('vendor_profiles')
            .select('company_name, is_verified, avg_rating')
            .eq('user_id', caller.id)
            .maybeSingle();
        if (!profile) {
            return NextResponse.json({ error: 'Create a vendor profile before quoting.' }, { status: 403 });
        }

        const { data: quote, error: insertErr } = await supabaseAdmin
            .from('quotes')
            .insert({
                job_id: jobId,
                vendor_id: caller.id,
                vendor_name: profile.company_name || 'Vendor',
                amount,
                estimated_days: estimatedDays,
                details,
                status: 'PENDING',
            })
            .select()
            .single();
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

        await supabaseAdmin.from('messages').insert({
            job_id: jobId,
            sender_id: caller.id,
            sender_type: 'vendor',
            content: `Quote submitted: $${amount} / ${estimatedDays} day(s). ${details.slice(0, 280)}`,
            is_agent_action: false,
        });

        const thread = await getOrCreateThread(jobId, 'native', `native:${caller.id}`);
        if (thread) {
            await supabaseAdmin.from('bid_threads').update({
                contractor_contact: { name: profile.company_name, userId: caller.id },
            }).eq('id', thread.id);
            await addBidMessage(thread.id, {
                direction: 'in',
                sender: profile.company_name || caller.id,
                body: details,
                extractedQuote: { amount, estimatedDays },
            });
            await setRankedQuote(thread.id, {
                quote_amount: amount,
                estimated_days: estimatedDays,
                license_verified: !!profile.is_verified,
                coi_verified: false,
                rating: profile.avg_rating ?? null,
                rank: null,
                notes: details.slice(0, 240),
            });
        }

        await dispatchNotification({
            userId: job.user_id,
            jobId,
            type: 'quote_ready',
            priority: 'high',
            title: 'New Quote Received',
            message: `${profile.company_name || 'A vendor'} quoted $${amount} on "${job.title}".`,
            actionRequired: true,
            actionUrl: '/dashboard',
        });

        await emitOracleEvent({
            eventType: 'quote.created',
            entityType: 'quote',
            entityId: quote.id,
            payload: { jobId, amount, estimatedDays },
        });

        return NextResponse.json({ success: true, data: quote }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
