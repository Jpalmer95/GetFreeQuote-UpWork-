'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { jobService } from '@/services/jobService';
import { Job, Notification, INDUSTRY_VERTICALS, IndustryVertical } from '@/types';
import { db } from '@/services/db';
import { vendorApi } from '@/services/vendorApi';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';
import VendorAnalytics from '@/components/VendorAnalytics';

type VendorTab = 'opportunities' | 'reviews';

interface PendingInvite {
    id: string;
    companyName: string;
    role: string;
    invitedAt: string;
}

export default function VendorDashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [industryFilter, setIndustryFilter] = useState<IndustryVertical | ''>('');
    const [activeTab, setActiveTab] = useState<VendorTab>('opportunities');
    const [agentActive, setAgentActive] = useState(true);
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (!user) return;

        const load = async () => {
            const [allJobs, config, notifs, invites] = await Promise.all([
                jobService.searchJobs({ industryVertical: industryFilter || undefined }),
                db.getAgentConfig(user.id),
                db.getNotifications(user.id),
                vendorApi.getPendingInvitations(),
            ]);
            setAvailableJobs(allJobs);
            setNotifications(notifs.filter(n => n.actionRequired));
            if (config) setAgentActive(config.isActive);
            setPendingInvites(invites);
        };
        load();
    }, [industryFilter, user, isLoading, router]);

    const handleAcceptInvite = async (memberId: string) => {
        setAcceptingId(memberId);
        try {
            await vendorApi.acceptInvitation(memberId);
            setPendingInvites(prev => prev.filter(inv => inv.id !== memberId));
        } catch (error) {
            console.error('Error accepting invitation:', error);
        } finally {
            setAcceptingId(null);
        }
    };

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    const pendingReviews = notifications.filter(n => n.actionRequired && !n.read);

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.header}>
                <h2 className="gradient-text">Vendor Portal</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Link href="/vendor/profile" className={styles.settingsLink}>Company Profile</Link>
                    <Link href="/vendor/estimating" className={styles.settingsLink}>Estimating</Link>
                    <Link href="/vendor/team" className={styles.settingsLink}>Team</Link>
                    <Link href="/agent-settings" className={styles.settingsLink}>Agent Settings</Link>
                </div>
            </div>

            {pendingInvites.length > 0 && (
                <div style={{ padding: '1rem 1.5rem', margin: '0 1.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>
                        Team Invitations ({pendingInvites.length})
                    </div>
                    {pendingInvites.map(inv => (
                        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.2)', marginBottom: '0.5rem' }}>
                            <div>
                                <span style={{ fontWeight: 500 }}>{inv.companyName}</span>
                                <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '0.75rem', fontSize: '0.85rem' }}>
                                    as {inv.role.replace('_', ' ')}
                                </span>
                            </div>
                            <button
                                onClick={() => handleAcceptInvite(inv.id)}
                                disabled={acceptingId === inv.id}
                                style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500, opacity: acceptingId === inv.id ? 0.6 : 1 }}
                            >
                                {acceptingId === inv.id ? 'Accepting...' : 'Accept'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <VendorAnalytics />

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
