'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { jobService } from '@/services/jobService';
import { Job, AgentAction, Notification, INDUSTRY_VERTICALS, IndustryVertical } from '@/types';
import { db } from '@/services/db';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';

const ACTION_ICONS: Record<string, string> = {
    job_broadcast: '📡',
    vendor_match: '🤝',
    auto_quote: '💰',
    clarification_sent: '❓',
    clarification_received: '💬',
    scope_analysis: '🔍',
    quote_comparison: '📊',
    escalation: '⚠️',
    negotiation: '🔄',
    auto_approve: '✅',
    auto_reject: '❌',
};

type VendorTab = 'opportunities' | 'agent-activity' | 'reviews';

export default function VendorDashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [industryFilter, setIndustryFilter] = useState<IndustryVertical | ''>('');
    const [activeTab, setActiveTab] = useState<VendorTab>('opportunities');
    const [agentActive, setAgentActive] = useState(true);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (!user) return;

        const load = async () => {
            const [allJobs, config, notifs] = await Promise.all([
                jobService.searchJobs({ industryVertical: industryFilter || undefined }),
                db.getAgentConfig(user.id),
                db.getNotifications(user.id),
            ]);
            setAvailableJobs(allJobs);
            setNotifications(notifs.filter(n => n.actionRequired));
            if (config) setAgentActive(config.isActive);
        };
        load();
    }, [industryFilter, user, isLoading, router]);

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    const pendingReviews = notifications.filter(n => n.actionRequired && !n.read);

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.header}>
                <h2 className="gradient-text">Vendor Portal</h2>
                <Link href="/agent-settings" className={styles.settingsLink}>Agent Settings</Link>
            </div>

            <div className={styles.statsBar}>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Agent Status</span>
                    <span className={`${styles.statValue} ${agentActive ? styles.statAccent : styles.statMuted}`}>
                        {agentActive ? 'Active' : 'Paused'}
                    </span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Opportunities</span>
                    <span className={`${styles.statValue} ${styles.statAmber}`}>{availableJobs.length}</span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Pending Reviews</span>
                    <span className={`${styles.statValue} ${pendingReviews.length > 0 ? styles.statPrimary : ''}`}>
                        {pendingReviews.length}
                    </span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Industries</span>
                    <span className={styles.statValue}>{INDUSTRY_VERTICALS.length}</span>
                </div>
            </div>

            <div className={styles.tabBar}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'opportunities' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('opportunities')}
                >
                    Opportunities ({availableJobs.length})
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('reviews')}
                >
                    Pending Reviews ({pendingReviews.length})
                </button>
            </div>

            <div className={styles.grid}>
                {activeTab === 'opportunities' && (
                    <>
                        <aside className={styles.filterPanel}>
                            <h4 className={styles.filterTitle}>Industry Filter</h4>
                            <select
                                value={industryFilter}
                                onChange={(e) => setIndustryFilter(e.target.value as IndustryVertical | '')}
                                className={styles.input}
                            >
                                <option value="">All Industries</option>
                                {INDUSTRY_VERTICALS.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </aside>

                        <section className={styles.marketSection}>
                            <div className={styles.feed}>
                                {availableJobs.map(job => (
                                    <div key={job.id} className={styles.jobCard}>
                                        <div className={styles.jobHeader}>
                                            <div className={styles.liveRow}>
                                                <span className={styles.liveDot} />
                                                <span className={styles.liveLabel}>Live</span>
                                            </div>
                                            <span className={styles.tag}>{job.industryVertical}</span>
                                        </div>
                                        <h4>{job.title}</h4>
                                        <p className={styles.jobSubcategory}>{job.subcategory || job.category}</p>
                                        <p>{job.location}</p>
                                        {job.budget && <p className={styles.jobBudget}>{job.budget}</p>}
                                        <div className={styles.botAction}>
                                            {agentActive ? (
                                                <span className={styles.success}>Agent Monitoring</span>
                                            ) : (
                                                <button className={styles.quoteBtn}>Manual Quote</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {availableJobs.length === 0 && (
                                    <p className={styles.emptyFeed}>No active projects match your filters.</p>
                                )}
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'reviews' && (
                    <section className={styles.reviewSection}>
                        {pendingReviews.length === 0 ? (
                            <p className={styles.emptyFeed}>No pending reviews. Your agent is handling everything.</p>
                        ) : (
                            pendingReviews.map(notif => (
                                <div key={notif.id} className={styles.reviewCard}>
                                    <div className={styles.reviewHeader}>
                                        <span className={styles.reviewTitle}>{notif.title}</span>
                                        <span className={`${styles.priorityBadge} ${styles[`priority${notif.priority.charAt(0).toUpperCase() + notif.priority.slice(1)}`]}`}>
                                            {notif.priority}
                                        </span>
                                    </div>
                                    <p className={styles.reviewMsg}>{notif.message}</p>
                                    <div className={styles.reviewActions}>
                                        {notif.actionUrl && (
                                            <Link href={notif.actionUrl} className={styles.reviewActionBtn}>View Details</Link>
                                        )}
                                        <button
                                            className={styles.dismissBtn}
                                            onClick={() => db.markNotificationRead(notif.id)}
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
