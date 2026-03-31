'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

interface PollRunRow {
    id: string;
    started_at: string;
    finished_at: string | null;
    jobs_scanned: number;
    jobs_expired: number;
    jobs_reminded: number;
    jobs_rematched: number;
    errors: { jobId: string; error: string }[];
    triggered_by: string;
}

export default function AdminPolling() {
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();
    const [runs, setRuns] = useState<PollRunRow[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [triggering, setTriggering] = useState(false);
    const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);

    const isAdmin = profile?.role === 'ADMIN';

    const getHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
    }, []);

    const fetchRuns = useCallback(async () => {
        setLoadingData(true);
        setPageError(null);
        try {
            const { data, error } = await supabase
                .from('poll_runs')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setRuns((data ?? []) as PollRunRow[]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load poll runs';
            setPageError(msg);
        }
        setLoadingData(false);
    }, []);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (!isLoading && user && isAdmin) {
            fetchRuns();
        }
    }, [user, isLoading, isAdmin, fetchRuns, router]);

    const triggerPoll = async () => {
        setTriggering(true);
        setLastResult(null);
        setPageError(null);
        try {
            const headers = await getHeaders();
            const pollSecret = '';
            const res = await fetch('/api/poll-jobs', {
                method: 'POST',
                headers: {
                    ...headers,
                    'Authorization': `Bearer ${pollSecret}`,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                setPageError(data.error || 'Poll trigger failed');
            } else {
                setLastResult(data);
                await fetchRuns();
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Poll trigger failed';
            setPageError(msg);
        }
        setTriggering(false);
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.accessDenied}>
                        <h2>Access Denied</h2>
                        <p>You do not have permission to view this page.</p>
                        <Link href="/dashboard" className={styles.backLink}>Return to Dashboard</Link>
                    </div>
                </div>
            </div>
        );
    }

    const totalExpired = runs.reduce((s, r) => s + (r.jobs_expired ?? 0), 0);
    const totalReminded = runs.reduce((s, r) => s + (r.jobs_reminded ?? 0), 0);
    const totalRematched = runs.reduce((s, r) => s + (r.jobs_rematched ?? 0), 0);
    const totalRuns = runs.length;

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.pageHeader}>
                    <div>
                        <Link href="/admin" className={styles.backLink}>← Admin</Link>
                        <h1 className={styles.pageTitle}>Poll Engine</h1>
                        <p className={styles.pageSubtitle}>
                            Monitors open jobs for inactivity — sends reminders and expires stale listings automatically.
                        </p>
                    </div>
                    <button
                        className={styles.triggerBtn}
                        onClick={triggerPoll}
                        disabled={triggering}
                    >
                        {triggering ? 'Running...' : '▶ Run Poll Now'}
                    </button>
                </div>

                {pageError && (
                    <div className={styles.errorBanner}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        <span>{pageError}</span>
                    </div>
                )}

                {lastResult && (
                    <div className={styles.resultBanner}>
                        <strong>Poll completed</strong> — Scanned: {lastResult.jobsScanned as number},
                        Expired: {lastResult.jobsExpired as number},
                        Reminded: {lastResult.jobsReminded as number},
                        Re-matched: {lastResult.jobsRematched as number}
                    </div>
                )}

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{totalRuns}</span>
                        <span className={styles.statLabel}>Total Runs</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{totalExpired}</span>
                        <span className={styles.statLabel}>Jobs Expired</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{totalReminded}</span>
                        <span className={styles.statLabel}>Reminders Sent</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{totalRematched}</span>
                        <span className={styles.statLabel}>Re-matches</span>
                    </div>
                </div>

                <h2 className={styles.sectionTitle}>Recent Runs</h2>

                {loadingData ? (
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading runs...</p>
                ) : runs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No poll runs yet. Click <strong>Run Poll Now</strong> to start the first run.</p>
                        <p className={styles.emptyHint}>
                            Configure a cron job to call <code>POST /api/poll-jobs</code> with your <code>POLL_SECRET</code> for automatic scheduling.
                        </p>
                    </div>
                ) : (
                    <div className={styles.runList}>
                        {runs.map(run => {
                            const duration = run.finished_at
                                ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                                : null;
                            const hasErrors = run.errors && run.errors.length > 0;
                            return (
                                <div key={run.id} className={`${styles.runCard} ${hasErrors ? styles.runCardError : ''}`}>
                                    <div className={styles.runHeader}>
                                        <div className={styles.runMeta}>
                                            <span className={styles.runDate}>
                                                {new Date(run.started_at).toLocaleString()}
                                            </span>
                                            <span className={`${styles.runBadge} ${run.finished_at ? styles.runBadgeSuccess : styles.runBadgePending}`}>
                                                {run.finished_at ? 'Complete' : 'Running'}
                                            </span>
                                            <span className={styles.runTrigger}>{run.triggered_by}</span>
                                        </div>
                                        {duration !== null && (
                                            <span className={styles.runDuration}>{duration}s</span>
                                        )}
                                    </div>

                                    <div className={styles.runStats}>
                                        <span className={styles.runStat}>
                                            <strong>{run.jobs_scanned ?? 0}</strong> scanned
                                        </span>
                                        <span className={styles.runStat}>
                                            <strong>{run.jobs_expired ?? 0}</strong> expired
                                        </span>
                                        <span className={styles.runStat}>
                                            <strong>{run.jobs_reminded ?? 0}</strong> reminded
                                        </span>
                                        <span className={styles.runStat}>
                                            <strong>{run.jobs_rematched ?? 0}</strong> re-matched
                                        </span>
                                    </div>

                                    {hasErrors && (
                                        <details className={styles.errorDetails}>
                                            <summary className={styles.errorSummary}>
                                                {run.errors.length} error{run.errors.length !== 1 ? 's' : ''}
                                            </summary>
                                            <ul className={styles.errorList}>
                                                {run.errors.map((e, i) => (
                                                    <li key={i}>
                                                        <code>{e.jobId}</code>: {e.error}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className={styles.configSection}>
                    <h2 className={styles.sectionTitle}>Configuration</h2>
                    <div className={styles.configGrid}>
                        <div className={styles.configItem}>
                            <span className={styles.configLabel}>Stale Reminder Threshold</span>
                            <span className={styles.configValue}>7 days</span>
                        </div>
                        <div className={styles.configItem}>
                            <span className={styles.configLabel}>Auto-Expire After</span>
                            <span className={styles.configValue}>30 days</span>
                        </div>
                        <div className={styles.configItem}>
                            <span className={styles.configLabel}>Max Reminders Per Job</span>
                            <span className={styles.configValue}>2</span>
                        </div>
                        <div className={styles.configItem}>
                            <span className={styles.configLabel}>Cron Endpoint</span>
                            <span className={styles.configValue}><code>POST /api/poll-jobs</code></span>
                        </div>
                        <div className={styles.configItem}>
                            <span className={styles.configLabel}>Auth</span>
                            <span className={styles.configValue}><code>POLL_SECRET</code> env var</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
