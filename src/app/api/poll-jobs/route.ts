import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchNotification } from '@/services/notificationDispatcher';
import { mapJobRow, mapAgentConfigRow, JobRow, AgentConfigRow } from '@/services/serverMappers';
import { matchVendorsToJob } from '@/services/vendorMatcher';

const EXPIRE_DAYS = 45;
const REMINDER_DAYS = 7;
const ZOMBIE_ACCEPTED_QUOTE_HOURS = 24;
const RECENT_VENDOR_HOURS = 24;
const COMMUNITY_FUNDING_THRESHOLD = 0.5;

interface PollStats {
    jobsScanned: number;
    jobsExpired: number;
    remindersSent: number;
    vendorRematches: number;
    communitySeeds: number;
    errors: { context: string; error: string }[];
}

function isServiceRoleAuth(req: NextRequest): boolean {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return false;
    const auth = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    return auth === serviceKey;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    if (!isServiceRoleAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runStart = Date.now();
    const stats: PollStats = {
        jobsScanned: 0,
        jobsExpired: 0,
        remindersSent: 0,
        vendorRematches: 0,
        communitySeeds: 0,
        errors: [],
    };

    const now = new Date();
    const expireCutoff = new Date(now.getTime() - EXPIRE_DAYS * 24 * 60 * 60 * 1000);
    const reminderCutoff = new Date(now.getTime() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
    const zombieAcceptedCutoff = new Date(now.getTime() - ZOMBIE_ACCEPTED_QUOTE_HOURS * 60 * 60 * 1000);
    const recentVendorCutoff = new Date(now.getTime() - RECENT_VENDOR_HOURS * 60 * 60 * 1000);

    const { data: openJobRows, error: fetchError } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('status', 'OPEN');

    if (fetchError) {
        await writePollRun(stats, Date.now() - runStart, {});
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const openJobs = (openJobRows ?? []).map(
        r => mapJobRow(r as unknown as JobRow & { last_reminded_at: string | null })
    );

    stats.jobsScanned = openJobs.length;

    if (openJobs.length > 0) {
        const jobIds = openJobs.map(j => j.id);

        const [quotesResult, allQuotesResult] = await Promise.all([
            supabaseAdmin
                .from('quotes')
                .select('job_id, accepted_at, created_at')
                .in('job_id', jobIds)
                .eq('status', 'ACCEPTED'),
            supabaseAdmin
                .from('quotes')
                .select('job_id')
                .in('job_id', jobIds),
        ]);

        const acceptedQuotes = quotesResult.data ?? [];
        const allQuotes = allQuotesResult.data ?? [];

        const zombieJobIds = new Set<string>();
        const anyAcceptedJobIds = new Set<string>();
        const quoteCountByJob = new Map<string, number>();

        for (const q of acceptedQuotes) {
            anyAcceptedJobIds.add(q.job_id);
            const acceptedTimestamp = q.accepted_at ? new Date(q.accepted_at) : new Date(q.created_at);
            if (acceptedTimestamp <= zombieAcceptedCutoff) {
                zombieJobIds.add(q.job_id);
            }
        }

        for (const q of allQuotes) {
            quoteCountByJob.set(q.job_id, (quoteCountByJob.get(q.job_id) ?? 0) + 1);
        }

        const expireIds: string[] = [];
        const expireReasons: Record<string, string> = {};
        const reminderIds: string[] = [];

        for (const job of openJobs) {
            const rawRow = openJobRows!.find(r => (r as Record<string, unknown>).id === job.id) as Record<string, unknown> | undefined;
            const lastRemindedAt = rawRow?.last_reminded_at as string | null;

            if (zombieJobIds.has(job.id)) {
                expireIds.push(job.id);
                expireReasons[job.id] = 'zombie_accepted_quote';
                continue;
            }

            const createdAt = new Date(job.createdAt);
            if (createdAt <= expireCutoff && !anyAcceptedJobIds.has(job.id)) {
                expireIds.push(job.id);
                expireReasons[job.id] = 'stale_no_activity';
                continue;
            }

            const quoteCount = quoteCountByJob.get(job.id) ?? 0;
            if (createdAt <= reminderCutoff && !lastRemindedAt && quoteCount === 0) {
                reminderIds.push(job.id);
            }
        }

        if (expireIds.length > 0) {
            await supabaseAdmin
                .from('jobs')
                .update({ status: 'EXPIRED' })
                .in('id', expireIds)
                .eq('status', 'OPEN');

            for (const jobId of expireIds) {
                const job = openJobs.find(j => j.id === jobId)!;
                const reason = expireReasons[jobId];
                const isZombie = reason === 'zombie_accepted_quote';

                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: job.userId,
                    action_type: 'job_expired',
                    summary: `Job "${job.title}" automatically expired (reason: ${reason}).`,
                    details: { reason, expire_days: isZombie ? null : EXPIRE_DAYS },
                    automated: true,
                });

                await dispatchNotification({
                    userId: job.userId,
                    jobId,
                    type: 'job_expired',
                    priority: 'high',
                    title: 'Job Listing Expired',
                    message: isZombie
                        ? `Your job "${job.title}" has been marked expired because an accepted quote has been pending for over ${ZOMBIE_ACCEPTED_QUOTE_HOURS} hours with no follow-through. Repost if you still need this work done.`
                        : `Your job "${job.title}" has expired after ${EXPIRE_DAYS} days with no activity. Repost it to attract new bids.`,
                    actionRequired: true,
                    actionUrl: `/dashboard`,
                });

                stats.jobsExpired++;
            }
        }

        if (reminderIds.length > 0) {
            await supabaseAdmin
                .from('jobs')
                .update({ last_reminded_at: now.toISOString() })
                .in('id', reminderIds);

            for (const jobId of reminderIds) {
                const job = openJobs.find(j => j.id === jobId)!;

                await supabaseAdmin.from('agent_actions').insert({
                    job_id: jobId,
                    user_id: job.userId,
                    action_type: 'job_reminder',
                    summary: `7-day no-quote reminder sent for job "${job.title}".`,
                    details: { reminder_days: REMINDER_DAYS },
                    automated: true,
                });

                await dispatchNotification({
                    userId: job.userId,
                    jobId,
                    type: 'job_reminder',
                    priority: 'medium',
                    title: 'Your Job Has No Quotes Yet',
                    message: `"${job.title}" has been open for ${REMINDER_DAYS} days with no quotes. Consider broadening your criteria, updating the description, or adjusting your budget to attract vendors.`,
                    actionRequired: false,
                    actionUrl: `/jobs/${jobId}`,
                });

                stats.remindersSent++;
            }
        }

        await vendorRematchPass(openJobs, recentVendorCutoff, stats);
    }

    let fundingSnapshot: Record<string, number> = {};
    try {
        fundingSnapshot = await communityJobSeedPass(stats);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ context: 'community_seed_pass', error: msg });
    }

    const durationMs = Date.now() - runStart;
    const runId = await writePollRun(stats, durationMs, fundingSnapshot);

    return NextResponse.json({
        success: true,
        runId,
        durationMs,
        jobsScanned: stats.jobsScanned,
        jobsExpired: stats.jobsExpired,
        remindersSent: stats.remindersSent,
        vendorRematches: stats.vendorRematches,
        communitySeeds: stats.communitySeeds,
        errors: stats.errors,
    });
}

async function vendorRematchPass(
    openJobs: ReturnType<typeof mapJobRow>[],
    recentVendorCutoff: Date,
    stats: PollStats,
): Promise<void> {
    if (openJobs.length === 0) return;

    const { data: recentVendorRows } = await supabaseAdmin
        .from('agent_configs')
        .select('*')
        .eq('role', 'vendor')
        .eq('is_active', true)
        .gte('updated_at', recentVendorCutoff.toISOString());

    if (!recentVendorRows || recentVendorRows.length === 0) return;

    const recentVendors = recentVendorRows.map((r) => mapAgentConfigRow(r as AgentConfigRow));
    const vendorUserIds = recentVendors.map(v => v.userId);
    const jobIds = openJobs.map(j => j.id);

    const [activeQuotesResult, existingRematchResult] = await Promise.all([
        supabaseAdmin
            .from('quotes')
            .select('vendor_id')
            .in('vendor_id', vendorUserIds)
            .eq('status', 'ACCEPTED'),
        supabaseAdmin
            .from('agent_actions')
            .select('job_id, user_id')
            .in('job_id', jobIds)
            .in('user_id', vendorUserIds)
            .eq('action_type', 'vendor_rematch')
            .gte('created_at', recentVendorCutoff.toISOString()),
    ]);

    const vendorActiveJobCount = new Map<string, number>();
    for (const q of activeQuotesResult.data ?? []) {
        vendorActiveJobCount.set(q.vendor_id, (vendorActiveJobCount.get(q.vendor_id) ?? 0) + 1);
    }

    const existingRematchSet = new Set<string>(
        (existingRematchResult.data ?? []).map(r => `${r.job_id}:${r.user_id}`)
    );

    for (const job of openJobs) {
        try {
            const matches = matchVendorsToJob(job, recentVendors, vendorActiveJobCount);
            if (matches.length === 0) continue;

            for (const { config: vc, score, reasons } of matches) {
                const dedupeKey = `${job.id}:${vc.userId}`;
                if (existingRematchSet.has(dedupeKey)) continue;
                existingRematchSet.add(dedupeKey);

                await supabaseAdmin.from('agent_actions').insert({
                    job_id: job.id,
                    user_id: vc.userId,
                    action_type: 'vendor_rematch',
                    summary: `New vendor agent re-matched to existing job "${job.title}".`,
                    details: { vendor_user_id: vc.userId, industries: vc.industries, score, reasons },
                    automated: true,
                });

                await dispatchNotification({
                    userId: vc.userId,
                    jobId: job.id,
                    type: 'job_match',
                    priority: 'medium',
                    title: 'New Project Match',
                    message: `A ${job.industryVertical} project "${job.title}" matches your expertise.`,
                    actionRequired: false,
                    actionUrl: `/vendor`,
                });

                stats.vendorRematches++;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            stats.errors.push({ context: `rematch:job:${job.id}`, error: msg });
        }
    }
}

async function communityJobSeedPass(stats: PollStats): Promise<Record<string, number>> {
    const { data: lastRun } = await supabaseAdmin
        .from('poll_runs')
        .select('run_at, funding_snapshot')
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastRunAt = lastRun?.run_at ? new Date(lastRun.run_at) : new Date(0);
    const previousSnapshot: Record<string, number> = (lastRun?.funding_snapshot as Record<string, number>) ?? {};

    const { data: allProjects } = await supabaseAdmin
        .from('community_projects')
        .select('id, creator_id, title, description, category, location, goal_amount, current_funding, created_at')
        .neq('status', 'CANCELLED');

    const projects = allProjects ?? [];

    const currentSnapshot: Record<string, number> = {};
    for (const p of projects) {
        if (p.goal_amount && p.goal_amount > 0) {
            currentSnapshot[p.id] = p.current_funding / p.goal_amount;
        }
    }

    const eligibleProjectIds: string[] = [];
    for (const p of projects) {
        const createdAt = new Date(p.created_at ?? 0);
        const isNewProject = createdAt > lastRunAt;

        const currentRatio = p.goal_amount && p.goal_amount > 0
            ? p.current_funding / p.goal_amount
            : 0;
        const prevRatio = previousSnapshot[p.id] ?? 0;
        const crossedThreshold =
            currentRatio >= COMMUNITY_FUNDING_THRESHOLD &&
            prevRatio < COMMUNITY_FUNDING_THRESHOLD;

        if (isNewProject || crossedThreshold) {
            eligibleProjectIds.push(p.id);
        }
    }

    if (eligibleProjectIds.length === 0) return currentSnapshot;

    const { data: linkedJobs } = await supabaseAdmin
        .from('jobs')
        .select('community_project_id')
        .in('community_project_id', eligibleProjectIds);

    const alreadySeeded = new Set((linkedJobs ?? []).map(j => j.community_project_id));

    const categoryMap: Record<string, string> = {
        'Parks & Recreation': 'Home Services',
        'Infrastructure': 'Commercial Construction',
        'Education': 'Professional Services',
        'Arts & Culture': 'Events & Entertainment',
        'Environment': 'Home Services',
        'Public Safety': 'Commercial Construction',
        'Community Spaces': 'Commercial Construction',
        'Open Source': 'Technology',
        'Other': 'Other',
    };

    for (const projectId of eligibleProjectIds) {
        if (alreadySeeded.has(projectId)) continue;

        const cp = projects.find(p => p.id === projectId);
        if (!cp) continue;

        try {
            const industryVertical = categoryMap[cp.category] || 'Other';

            const { error: insertError } = await supabaseAdmin.from('jobs').insert({
                user_id: cp.creator_id,
                title: `[Community] ${cp.title}`,
                category: cp.category,
                description: cp.description || `Community project: ${cp.title}. Location: ${cp.location}.`,
                location: cp.location || 'TBD',
                tags: ['community', cp.category.toLowerCase()],
                is_public: false,
                requires_permit: false,
                industry_vertical: industryVertical,
                subcategory: 'Other',
                urgency: 'flexible',
                community_project_id: cp.id,
                status: 'DRAFT',
            });

            if (insertError) {
                stats.errors.push({ context: `community_seed:${cp.id}`, error: insertError.message });
                continue;
            }

            stats.communitySeeds++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            stats.errors.push({ context: `community_seed:${cp.id}`, error: msg });
        }
    }

    return currentSnapshot;
}

async function writePollRun(
    stats: PollStats,
    durationMs: number,
    fundingSnapshot: Record<string, number>,
): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('poll_runs')
        .insert({
            run_at: new Date().toISOString(),
            duration_ms: durationMs,
            jobs_scanned: stats.jobsScanned,
            jobs_expired: stats.jobsExpired,
            reminders_sent: stats.remindersSent,
            vendor_rematches: stats.vendorRematches,
            community_seeds: stats.communitySeeds,
            errors: stats.errors,
            triggered_by: 'api',
            funding_snapshot: fundingSnapshot,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[poll-jobs] Failed to write poll_run:', error.message);
        return null;
    }

    return data.id;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (!isServiceRoleAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: runs, error } = await supabaseAdmin
        .from('poll_runs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ runs });
}
