import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchNotification } from '@/services/notificationDispatcher';
import { mapJobRow, JobRow } from '@/services/serverMappers';

const POLL_SECRET = process.env.POLL_SECRET;

const STALE_REMINDER_DAYS = 7;
const EXPIRE_DAYS = 30;
const MAX_REMINDERS = 2;

interface PollStats {
    jobsScanned: number;
    jobsExpired: number;
    jobsReminded: number;
    jobsRematched: number;
    errors: { jobId: string; error: string }[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '').trim();

    if (!POLL_SECRET || providedSecret !== POLL_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runId = await startPollRun();
    const stats: PollStats = {
        jobsScanned: 0,
        jobsExpired: 0,
        jobsReminded: 0,
        jobsRematched: 0,
        errors: [],
    };

    const now = new Date();
    const reminderCutoff = new Date(now.getTime() - STALE_REMINDER_DAYS * 24 * 60 * 60 * 1000);
    const expireCutoff = new Date(now.getTime() - EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    const { data: openJobs, error: fetchError } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('status', 'OPEN')
        .lte('created_at', reminderCutoff.toISOString());

    if (fetchError) {
        await finishPollRun(runId, stats);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    stats.jobsScanned = openJobs?.length ?? 0;

    for (const rawJob of openJobs ?? []) {
        const job = mapJobRow(rawJob as JobRow & { last_reminded_at: string | null });
        const createdAt = new Date(job.createdAt);
        const lastRemindedAt = rawJob.last_reminded_at ? new Date(rawJob.last_reminded_at) : null;

        try {
            if (createdAt <= expireCutoff) {
                await expireJob(rawJob.id, job.userId, job.title, stats);
                continue;
            }

            const daysSinceReminder = lastRemindedAt
                ? (now.getTime() - lastRemindedAt.getTime()) / (1000 * 60 * 60 * 24)
                : null;

            const reminderCount = rawJob.reminder_count ?? 0;

            const shouldRemind =
                reminderCount < MAX_REMINDERS &&
                (lastRemindedAt === null || (daysSinceReminder !== null && daysSinceReminder >= STALE_REMINDER_DAYS));

            if (shouldRemind) {
                await remindOwner(rawJob.id, job.userId, job.title, reminderCount, stats);
            }

            const { count: quoteCount } = await supabaseAdmin
                .from('quotes')
                .select('*', { count: 'exact', head: true })
                .eq('job_id', rawJob.id);

            if ((quoteCount ?? 0) === 0) {
                await triggerVendorRematch(rawJob.id, job.userId, job.title, stats);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            stats.errors.push({ jobId: rawJob.id, error: msg });
        }
    }

    await finishPollRun(runId, stats);

    return NextResponse.json({
        success: true,
        runId,
        ...stats,
    });
}

async function expireJob(
    jobId: string,
    ownerId: string,
    jobTitle: string,
    stats: PollStats,
): Promise<void> {
    const { error } = await supabaseAdmin
        .from('jobs')
        .update({ status: 'EXPIRED' })
        .eq('id', jobId)
        .eq('status', 'OPEN');

    if (error) throw new Error(`expire update: ${error.message}`);

    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: ownerId,
        action_type: 'job_expired',
        summary: `Job "${jobTitle}" automatically expired after ${EXPIRE_DAYS} days with no activity.`,
        details: { reason: 'stale_no_activity', expire_days: EXPIRE_DAYS },
        automated: true,
    });

    await dispatchNotification({
        userId: ownerId,
        jobId,
        type: 'job_expired',
        priority: 'high',
        title: 'Job Listing Expired',
        message: `Your job "${jobTitle}" has expired after ${EXPIRE_DAYS} days. Repost it to attract new bids.`,
        actionRequired: true,
        actionUrl: `/dashboard`,
    });

    stats.jobsExpired++;
}

async function remindOwner(
    jobId: string,
    ownerId: string,
    jobTitle: string,
    currentCount: number,
    stats: PollStats,
): Promise<void> {
    const reminderNumber = currentCount + 1;
    const daysLeft = EXPIRE_DAYS - STALE_REMINDER_DAYS * reminderNumber;

    await supabaseAdmin
        .from('jobs')
        .update({
            last_reminded_at: new Date().toISOString(),
            reminder_count: reminderNumber,
        })
        .eq('id', jobId);

    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: ownerId,
        action_type: 'job_reminder',
        summary: `Stale-listing reminder #${reminderNumber} sent for job "${jobTitle}".`,
        details: { reminder_number: reminderNumber, days_until_expiry: daysLeft },
        automated: true,
    });

    await dispatchNotification({
        userId: ownerId,
        jobId,
        type: 'job_reminder',
        priority: 'medium',
        title: 'Your Job is Still Open',
        message: `"${jobTitle}" hasn't received any bids yet. It will expire in ~${Math.max(daysLeft, 7)} days if no activity is detected. Consider updating the description or budget.`,
        actionRequired: false,
        actionUrl: `/jobs/${jobId}`,
    });

    stats.jobsReminded++;
}

async function triggerVendorRematch(
    jobId: string,
    ownerId: string,
    jobTitle: string,
    stats: PollStats,
): Promise<void> {
    const { data: vendorConfigs } = await supabaseAdmin
        .from('agent_configs')
        .select('*')
        .eq('role', 'vendor')
        .eq('is_active', true);

    if (!vendorConfigs || vendorConfigs.length === 0) return;

    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: ownerId,
        action_type: 'vendor_rematch',
        summary: `Vendor re-match triggered for stale job "${jobTitle}" — ${vendorConfigs.length} active vendor agent(s) considered.`,
        details: { vendor_agent_count: vendorConfigs.length },
        automated: true,
    });

    stats.jobsRematched++;
}

async function startPollRun(): Promise<string> {
    const { data, error } = await supabaseAdmin
        .from('poll_runs')
        .insert({
            started_at: new Date().toISOString(),
            triggered_by: 'api',
        })
        .select('id')
        .single();

    if (error) throw new Error(`poll_run insert: ${error.message}`);
    return data.id;
}

async function finishPollRun(runId: string, stats: PollStats): Promise<void> {
    await supabaseAdmin.from('poll_runs').update({
        finished_at: new Date().toISOString(),
        jobs_scanned: stats.jobsScanned,
        jobs_expired: stats.jobsExpired,
        jobs_reminded: stats.jobsReminded,
        jobs_rematched: stats.jobsRematched,
        errors: stats.errors,
    }).eq('id', runId);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '').trim();

    if (!POLL_SECRET || providedSecret !== POLL_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: runs, error } = await supabaseAdmin
        .from('poll_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ runs });
}
