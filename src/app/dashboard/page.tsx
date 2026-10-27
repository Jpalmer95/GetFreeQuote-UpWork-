'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import JobCard from '@/components/JobCard';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/context/AuthContext';
import type { Job, IndustryVertical } from '@/types';
import styles from './page.module.css';

interface QuoteRow {
    id: string;
    job_id: string;
    vendor_name: string;
    amount: number;
    estimated_days: number;
    status: string;
    created_at: string;
}

interface Notice {
    id: string;
    title: string;
    message: string;
    type: string;
    job_id?: string;
    read?: boolean;
    created_at: string;
    source: 'notification' | 'agent';
}

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'COMPLETED', label: 'Completed' },
] as const;

function relative(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function mapJob(row: Record<string, unknown>): Job {
    return {
        id: String(row.id),
        userId: String(row.user_id),
        title: String(row.title || 'Untitled job'),
        category: String(row.category || 'Other'),
        description: String(row.description || ''),
        location: String(row.location || ''),
        status: String(row.status || 'OPEN') as Job['status'],
        createdAt: String(row.created_at || new Date().toISOString()),
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        isPublic: !!row.is_public,
        requiresPermit: !!row.requires_permit,
        budget: row.budget ? String(row.budget) : undefined,
        industryVertical: String(row.industry_vertical || 'Other') as IndustryVertical,
        subcategory: String(row.subcategory || ''),
        urgency: (row.urgency as Job['urgency']) || 'flexible',
        squareFootage: row.square_footage ? String(row.square_footage) : undefined,
        materials: row.materials ? String(row.materials) : undefined,
        attachments: Array.isArray(row.attachments) ? (row.attachments as string[]) : [],
        timelineStart: row.timeline_start ? String(row.timeline_start) : undefined,
        timelineEnd: row.timeline_end ? String(row.timeline_end) : undefined,
        isLocalRequest: !!row.is_local_request,
        locationLat: row.location_lat ? Number(row.location_lat) : undefined,
        locationLng: row.location_lng ? Number(row.location_lng) : undefined,
        radiusMiles: row.radius_miles ? Number(row.radius_miles) : undefined,
        workKind: (row.work_kind as Job['workKind']) || 'quote',
    };
}

export default function DashboardPage() {
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [jobs, setJobs] = useState<Job[]>([]);
    const [quotes, setQuotes] = useState<QuoteRow[]>([]);
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]['value']>('all');

    useEffect(() => {
        if (!isLoading && !user) router.push('/login?redirect=/dashboard');
    }, [isLoading, user, router]);

    const load = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            let json: { error?: string; data?: Record<string, unknown> } = {};
            try {
                json = await res.json();
            } catch {
                /* empty body */
            }
            if (!res.ok || !json.data) {
                setError(json.error || `Could not load your desk (HTTP ${res.status}).`);
                return;
            }
            const data = json.data as {
                jobs: Record<string, unknown>[];
                quotes: QuoteRow[];
                notifications: Record<string, unknown>[];
                agentActions: Record<string, unknown>[];
            };
            setJobs((data.jobs || []).map(mapJob));
            setQuotes(data.quotes || []);
            const merged: Notice[] = [
                ...(data.notifications || []).map(n => ({
                    id: String(n.id),
                    title: String(n.title || 'Update'),
                    message: String(n.message || ''),
                    type: String(n.type || 'notification'),
                    job_id: n.job_id ? String(n.job_id) : undefined,
                    read: !!n.read,
                    created_at: String(n.created_at),
                    source: 'notification' as const,
                })),
                ...(data.agentActions || []).map(a => ({
                    id: String(a.id),
                    title: String(a.action_type || 'agent').replace(/_/g, ' '),
                    message: String(a.summary || ''),
                    type: 'agent',
                    job_id: a.job_id ? String(a.job_id) : undefined,
                    created_at: String(a.created_at),
                    source: 'agent' as const,
                })),
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setNotices(merged.slice(0, 12));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load your desk.');
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        void load();
    }, [load]);

    const quotesByJob = useMemo(() => {
        const map = new Map<string, QuoteRow[]>();
        for (const q of quotes) {
            const list = map.get(q.job_id) || [];
            list.push(q);
            map.set(q.job_id, list);
        }
        return map;
    }, [quotes]);

    const totals = useMemo(() => {
        const open = jobs.filter(j => j.status === 'OPEN').length;
        const inProgress = jobs.filter(j => j.status === 'IN_PROGRESS').length;
        const completed = jobs.filter(j => j.status === 'COMPLETED').length;
        const quotesReceived = quotes.length;
        const awardedValue = quotes
            .filter(q => q.status === 'ACCEPTED')
            .reduce((sum, q) => sum + Number(q.amount || 0), 0);
        return { open, inProgress, completed, quotesReceived, awardedValue };
    }, [jobs, quotes]);

    const visible = useMemo(
        () => (status === 'all' ? jobs : jobs.filter(j => j.status === status)),
        [jobs, status],
    );

    if (isLoading || (loading && !error && jobs.length === 0)) {
        return <div className="loading-screen">Loading your desk…</div>;
    }

    const firstName = user?.email?.split('@')[0] || 'there';

    return (
        <div>
            <Navbar />
            <main className="gfq-page">
                <div className="gfq-head">
                    <div>
                        <span className="gfq-eyebrow">Your desk</span>
                        <h1 className="gfq-title">Jobs you own</h1>
                        <p className="gfq-sub">
                            Every request you have posted, the quotes that came back, and what your agent has done
                            on your behalf.
                        </p>
                    </div>
                    <div className={styles.headActions}>
                        <Link href="/post-job" className="btn-primary">
                            Post a job
                        </Link>
                        <Link href="/vendor" className="btn-secondary">
                            Find work
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="gfq-alert gfq-alert-error" role="alert">
                        {error}
                        <button type="button" className={styles.retry} onClick={() => void load()}>
                            Retry
                        </button>
                    </div>
                )}

                <section className={styles.metrics} aria-label="Summary">
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{totals.open}</span>
                        <span className={styles.metricLabel}>Open for quotes</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{totals.quotesReceived}</span>
                        <span className={styles.metricLabel}>Quotes received</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{totals.inProgress}</span>
                        <span className={styles.metricLabel}>In progress</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>
                            {totals.awardedValue > 0 ? `$${Math.round(totals.awardedValue).toLocaleString()}` : '—'}
                        </span>
                        <span className={styles.metricLabel}>Awarded value</span>
                    </div>
                </section>

                <div className={styles.columns}>
                    <section aria-labelledby="jobs-heading">
                        <div className={styles.listHead}>
                            <h2 id="jobs-heading" className={styles.listTitle}>
                                {status === 'all' ? 'All jobs' : `${status.replace('_', ' ').toLowerCase()} jobs`}
                                <span className={styles.count}>{visible.length}</span>
                            </h2>
                            <div className="gfq-tabs" role="tablist" aria-label="Filter by status">
                                {STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={status === f.value}
                                        className="gfq-tab"
                                        onClick={() => setStatus(f.value)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {jobs.length === 0 ? (
                            <EmptyState
                                icon="✚"
                                title="No jobs yet"
                                body="Describe the work once — a photo, a video, or a few sentences. Contractors and their agents quote against the brief, and you only step in to award it."
                                actionLabel="Post your first job"
                                actionHref="/post-job"
                                secondaryLabel="See how it works"
                                secondaryHref="/how-to"
                            />
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="◇"
                                title="Nothing in this state"
                                body="No jobs match that status filter."
                                actionLabel="Show all jobs"
                                actionHref="/dashboard"
                            />
                        ) : (
                            <div className={styles.jobGrid}>
                                {visible.map(job => {
                                    const jq = quotesByJob.get(job.id) || [];
                                    return (
                                        <JobCard key={job.id} job={job} quoteCount={jq.length} owned />
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <aside className={styles.side} aria-labelledby="activity-heading">
                        <div className={styles.card}>
                            <h2 id="activity-heading" className={styles.listTitle}>
                                Activity
                            </h2>
                            {notices.length === 0 ? (
                                <p className={styles.muted}>
                                    Nothing yet. When a quote lands or your agent does something, it shows up here.
                                </p>
                            ) : (
                                <ul className={styles.feed}>
                                    {notices.map(n => (
                                        <li key={`${n.source}-${n.id}`} className={styles.feedItem}>
                                            <div className={styles.feedTop}>
                                                <span className={styles.feedType}>{n.title}</span>
                                                <span className={styles.feedTime}>{relative(n.created_at)}</span>
                                            </div>
                                            <p className={styles.feedMsg}>{n.message}</p>
                                            {n.job_id && (
                                                <Link href={`/jobs/${n.job_id}`} className={styles.feedLink}>
                                                    Open job →
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className={styles.card}>
                            <h2 className={styles.listTitle}>Working with an agent?</h2>
                            <p className={styles.muted}>
                                Give your agent an API key and it can post, bid, and answer questions for you —
                                you still approve the final award.
                            </p>
                            <Link href="/settings/api-keys" className="btn-secondary">
                                Agent API keys
                            </Link>
                        </div>
                    </aside>
                </div>

                <p className={styles.hello}>Signed in as {firstName}.</p>
            </main>
            <SiteFooter />
        </div>
    );
}
