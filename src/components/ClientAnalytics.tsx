'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ClientAnalytics.module.css';

interface ClientStats {
    totalJobs: number;
    avgQuotesPerJob: number;
    totalSpent: number;
    avgSavings: number;
    completionRate: number;
}

export default function ClientAnalytics() {
    const { session } = useAuth();
    const [stats, setStats] = useState<ClientStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) return;
        const load = async () => {
            try {
                const res = await fetch('/api/analytics?action=client-stats', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    setStats(await res.json());
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [session]);

    if (loading) return null;
    if (!stats || stats.totalJobs === 0) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Project Insights</h3>
            </div>

            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>{stats.totalJobs}</span>
                    <span className={styles.metricLabel}>Jobs Posted</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>{stats.avgQuotesPerJob}</span>
                    <span className={styles.metricLabel}>Avg Quotes/Job</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={`${styles.metricValue} ${styles.accentBlue}`}>
                        ${stats.totalSpent.toLocaleString()}
                    </span>
                    <span className={styles.metricLabel}>Total Spent</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={`${styles.metricValue} ${styles.accentGreen}`}>
                        {stats.avgSavings}%
                    </span>
                    <span className={styles.metricLabel}>Avg Savings</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>{stats.completionRate}%</span>
                    <span className={styles.metricLabel}>Completion Rate</span>
                </div>
            </div>
        </div>
    );
}
