import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchNotification } from '@/services/notificationDispatcher';
import { mapJobRow, mapAgentConfigRow, JobRow, AgentConfigRow } from '@/services/serverMappers';
import { Job, AgentConfig } from '@/types';

const EXPIRE_DAYS = 45;
const REMINDER_DAYS = 7;
const ZOMBIE_ACCEPTED_QUOTE_HOURS = 24;
const RECENT_VENDOR_HOURS = 24;
const COMMUNITY_SEED_WINDOW_HOURS = 24;
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
    const zombieQuoteCutoff = new Date(now.getTime() - ZOMBIE_ACCEPTED_QUOTE_HOURS * 60 * 60 * 1000);
    const recentVendorCutoff = new Date(now.getTime() - RECENT_VENDOR_HOURS * 60 * 60 * 1000);
    const communitySeedCutoff = new Date(now.getTime() - COMMUNITY_SEED_WINDOW_HOURS * 60 * 60 * 1000);

    const { data: openJobs, error: fetchError } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('status', 'OPEN');

    if (fetchError) {
        await writePollRun(stats, Date.now() - runStart);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    stats.jobsScanned = openJobs?.length ?? 0;

    for (const rawJob of openJobs ?? []) {
        const job = mapJobRow(rawJob as JobRow & { last_reminded_at: string | null });
        const createdAt = new Date(job.createdAt);

        try {
            const isOlderThan45Days = createdAt <= expireCutoff;

            let isZombie = false;
            const { count: acceptedCount } = await supabaseAdmin
                .from('quotes')
                .select('*', { count: 'exact', head: true })
                .eq('job_id', rawJob.id)
                .eq('status', 'ACCEPTED');

            const hasAcceptedQuote = (acceptedCount ?? 0) > 0;

            if (isOlderThan45Days && !hasAcceptedQuote) {
                await expireJob(rawJob.id, job.userId, job.title, 'stale_no_activity', stats);
                continue;
            }

            if (!isOlderThan45Days && hasAcceptedQuote) {
                const { count: recentAccepted } = await supabaseAdmin
                    .from('quotes')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', rawJob.id)
                    .eq('status', 'ACCEPTED')
                    .lte('created_at', zombieQuoteCutoff.toISOString());

                if ((recentAccepted ?? 0) > 0) {
                    isZombie = true;
                }
            }

            if (isZombie) {
                await expireJob(rawJob.id, job.userId, job.title, 'zombie_accepted_quote', stats);
                continue;
            }

            if (createdAt <= reminderCutoff && !rawJob.last_reminded_at) {
                const { count: quoteCount } = await supabaseAdmin
                    .from('quotes')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', rawJob.id);

                if ((quoteCount ?? 0) === 0) {
                    await remindOwner(rawJob.id, job.userId, job.title, stats);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            stats.errors.push({ context: `job:${rawJob.id}`, error: msg });
        }
    }

    try {
        await vendorRematchPass(openJobs ?? [], recentVendorCutoff, stats);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ context: 'vendor_rematch_pass', error: msg });
    }

    try {
        await communityJobSeedPass(communitySeedCutoff, stats);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ context: 'community_seed_pass', error: msg });
    }

    const durationMs = Date.now() - runStart;
    const runId = await writePollRun(stats, durationMs);

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

async function expireJob(
    jobId: string,
    ownerId: string,
    jobTitle: string,
    reason: string,
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
        summary: `Job "${jobTitle}" automatically expired (reason: ${reason}).`,
        details: { reason, expire_days: reason === 'stale_no_activity' ? EXPIRE_DAYS : null },
        automated: true,
    });

    const isZombie = reason === 'zombie_accepted_quote';
    await dispatchNotification({
        userId: ownerId,
        jobId,
        type: 'job_expired',
        priority: 'high',
        title: 'Job Listing Expired',
        message: isZombie
            ? `Your job "${jobTitle}" has been marked expired because an accepted quote has been pending for over ${ZOMBIE_ACCEPTED_QUOTE_HOURS} hours with no follow-through. Repost if you still need this work done.`
            : `Your job "${jobTitle}" has expired after ${EXPIRE_DAYS} days with no activity. Repost it to attract new bids.`,
        actionRequired: true,
        actionUrl: `/dashboard`,
    });

    stats.jobsExpired++;
}

async function remindOwner(
    jobId: string,
    ownerId: string,
    jobTitle: string,
    stats: PollStats,
): Promise<void> {
    await supabaseAdmin
        .from('jobs')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', jobId);

    await supabaseAdmin.from('agent_actions').insert({
        job_id: jobId,
        user_id: ownerId,
        action_type: 'job_reminder',
        summary: `7-day no-quote reminder sent for job "${jobTitle}".`,
        details: { reminder_days: REMINDER_DAYS },
        automated: true,
    });

    await dispatchNotification({
        userId: ownerId,
        jobId,
        type: 'job_reminder',
        priority: 'medium',
        title: 'Your Job Has No Quotes Yet',
        message: `"${jobTitle}" has been open for ${REMINDER_DAYS} days with no quotes. Consider broadening your criteria, updating the description, or adjusting your budget to attract vendors.`,
        actionRequired: false,
        actionUrl: `/jobs/${jobId}`,
    });

    stats.remindersSent++;
}

async function vendorRematchPass(
    openJobs: Record<string, unknown>[],
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

    for (const rawJob of openJobs) {
        const job = mapJobRow(rawJob as unknown as JobRow & { last_reminded_at: string | null });

        try {
            const matched = matchVendorsToJob(job, recentVendors);

            if (matched.length === 0) continue;

            for (const vc of matched) {
                await supabaseAdmin.from('agent_actions').insert({
                    job_id: job.id,
                    user_id: vc.userId,
                    action_type: 'vendor_rematch',
                    summary: `New vendor agent re-matched to existing job "${job.title}".`,
                    details: { vendor_user_id: vc.userId, industries: vc.industries },
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
            stats.errors.push({ context: `rematch:job:${rawJob.id}`, error: msg });
        }
    }
}

function matchVendorsToJob(job: Job, vendors: AgentConfig[]): AgentConfig[] {
    const budgetNum = job.budget ? parseFloat(String(job.budget).replace(/[^0-9.]/g, '')) : null;
    const matched: AgentConfig[] = [];

    for (const vc of vendors) {
        if (vc.industries.length > 0 && !vc.industries.includes(job.industryVertical)) continue;
        if (vc.maxBudget && budgetNum && budgetNum > vc.maxBudget) continue;
        if (vc.minBudget && budgetNum && budgetNum < vc.minBudget) continue;
        if (vc.serviceArea.length > 0 && job.location) {
            const jobLoc = job.location.toLowerCase();
            const inArea = vc.serviceArea.some((area: string) => {
                const a = area.toLowerCase();
                return jobLoc.includes(a) || a.includes(jobLoc);
            });
            if (!inArea) continue;
        }
        matched.push(vc);
    }

    return matched;
}

async function communityJobSeedPass(
    windowCutoff: Date,
    stats: PollStats,
): Promise<void> {
    const { data: recentProjects } = await supabaseAdmin
        .from('community_projects')
        .select('id, creator_id, title, description, category, location, goal_amount, current_funding')
        .gte('created_at', windowCutoff.toISOString())
        .neq('status', 'CANCELLED');

    const { data: fundingProjects } = await supabaseAdmin
        .from('community_projects')
        .select('id, creator_id, title, description, category, location, goal_amount, current_funding')
        .neq('status', 'CANCELLED')
        .lt('created_at', windowCutoff.toISOString());

    const allProjects = [
        ...(recentProjects ?? []),
        ...(fundingProjects ?? []).filter(p => {
            if (!p.goal_amount || p.goal_amount <= 0) return false;
            return (p.current_funding / p.goal_amount) >= COMMUNITY_FUNDING_THRESHOLD;
        }),
    ];

    const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values());

    for (const cp of uniqueProjects) {
        try {
            const { count: existingCount } = await supabaseAdmin
                .from('jobs')
                .select('*', { count: 'exact', head: true })
                .eq('community_project_id', cp.id);

            if ((existingCount ?? 0) > 0) continue;

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
}

async function writePollRun(stats: PollStats, durationMs: number): Promise<string | null> {
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
