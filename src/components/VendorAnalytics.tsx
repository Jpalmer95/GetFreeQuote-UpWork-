'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './VendorAnalytics.module.css';

interface VendorStats {
    totalQuotes: number;
    winRate: number;
    avgAmount: number;
    revenue: number;
    acceptedCount: number;
    avgResponseTimeHours: number;
    activity30d: { date: string; count: number }[];
}

function formatResponseTime(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
}

export default function VendorAnalytics() {
    const { session } = useAuth();
    const [stats, setStats] = useState<VendorStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) return;
        const load = async () => {
            try {
                const res = await fetch('/api/analytics?action=vendor-stats', {
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

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Analytics</h3>
                </div>
                <p className={styles.loading}>Loading analytics...</p>
            </div>
        );
    }

    if (!stats) return null;

    const maxCount = Math.max(...stats.activity30d.map(d => d.count), 1);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Performance Analytics</h3>
                <span className={styles.period}>Last 30 days</span>
            </div>

            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>{stats.totalQuotes}</span>
                    <span className={styles.metricLabel}>Quotes Submitted</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={`${styles.metricValue} ${styles.accentGreen}`}>{stats.winRate}%</span>
                    <span className={styles.metricLabel}>Win Rate</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>${stats.avgAmount.toLocaleString()}</span>
                    <span className={styles.metricLabel}>Avg Quote</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={`${styles.metricValue} ${styles.accentBlue}`}>${stats.revenue.toLocaleString()}</span>
                    <span className={styles.metricLabel}>Total Revenue</span>
                </div>
                <div className={styles.metricCard}>
                    <span className={styles.metricValue}>{formatResponseTime(stats.avgResponseTimeHours)}</span>
                    <span className={styles.metricLabel}>Avg Response</span>
                </div>
            </div>

            <div className={styles.chartSection}>
                <div className={styles.chartHeader}>
                    <span className={styles.chartTitle}>Quote Activity</span>
                    <span className={styles.chartSubtitle}>{stats.acceptedCount} accepted</span>
                </div>
                <div className={styles.chart}>
                    {stats.activity30d.map((d, i) => (
                        <div key={d.date} className={styles.barWrap} title={`${d.date}: ${d.count} quotes`}>
                            <div
                                className={styles.bar}
                                style={{ height: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 2)}%` }}
                            />
                            {i % 7 === 0 && (
                                <span className={styles.barLabel}>{d.date.slice(5)}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
