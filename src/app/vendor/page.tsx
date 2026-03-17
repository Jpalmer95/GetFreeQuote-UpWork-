'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, INDUSTRY_VERTICALS, IndustryVertical } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';

export default function VendorDashboard() {
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [autoQuoteEnabled, setAutoQuoteEnabled] = useState(true);
    const [baseRate, setBaseRate] = useState(100);
    const [maxDistance, setMaxDistance] = useState(25);
    const [industryFilter, setIndustryFilter] = useState<IndustryVertical | ''>('');

    useEffect(() => {
        const load = async () => {
            const allJobs = await jobService.searchJobs({
                industryVertical: industryFilter || undefined,
            });
            setAvailableJobs(allJobs);
        };
        load();
    }, [industryFilter]);

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.header}>
                <h2 className="gradient-text">Vendor Portal</h2>
            </div>

            <div className={styles.statsBar}>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Industries</span>
                    <span className={`${styles.statValue} ${styles.statAccent}`}>{INDUSTRY_VERTICALS.length}</span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Win Rate</span>
                    <span className={`${styles.statValue} ${styles.statPrimary}`}>24%</span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Active Opportunities</span>
                    <span className={`${styles.statValue} ${styles.statAmber}`}>{availableJobs.length}</span>
                </div>
                <div className={styles.statTile}>
                    <span className={styles.statLabel}>Avg Response</span>
                    <span className={styles.statValue}>4 min</span>
                </div>
            </div>

            <div className={styles.grid}>
                <section className={`glass-panel ${styles.settingsCard}`}>
                    <div className={styles.settingsHeader}>
                        <div className={styles.settingsIcon}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z"/>
                            </svg>
                        </div>
                        <h3>Auto-Quote Agent</h3>
                    </div>
                    <p className={styles.desc}>Configure how your AI agent responds to incoming project opportunities.</p>

                    <div className={styles.settingRow}>
                        <label>Agent Status</label>
                        <button
                            className={`${styles.toggle} ${autoQuoteEnabled ? styles.active : ''}`}
                            onClick={() => setAutoQuoteEnabled(!autoQuoteEnabled)}
                        >
                            {autoQuoteEnabled ? 'ACTIVE' : 'PAUSED'}
                        </button>
                    </div>

                    <div className={styles.settingRow}>
                        <label>Base Hourly Rate ($)</label>
                        <input
                            type="number"
                            value={baseRate}
                            onChange={(e) => setBaseRate(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.settingRow}>
                        <label>Max Distance (miles)</label>
                        <input
                            type="number"
                            value={maxDistance}
                            onChange={(e) => setMaxDistance(Number(e.target.value))}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.settingRow}>
                        <label>Industry Focus</label>
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
                    </div>
                </section>

                <section className={styles.marketSection}>
                    <h3>Live Opportunity Feed</h3>
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
                                <div className={styles.botAction}>
                                    {autoQuoteEnabled ? (
                                        <span className={styles.success}>
                                            Auto-Quoted ${(baseRate * 1.2).toFixed(0)}
                                        </span>
                                    ) : (
                                        <button className={styles.quoteBtn}>Manual Quote</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {availableJobs.length === 0 && (
                            <p className={styles.emptyFeed}>No active projects in your area.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
