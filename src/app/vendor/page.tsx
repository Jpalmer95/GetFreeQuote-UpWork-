'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job } from '@/types';
import styles from './page.module.css';

export default function VendorDashboard() {
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [autoQuoteEnabled, setAutoQuoteEnabled] = useState(true);
    const [baseRate, setBaseRate] = useState(100);

    useEffect(() => {
        // In a real app, this would be "getOpenJobs" or similar
        // For mock, getting all jobs to show the "Marketplace"
        const allJobs = jobService.getMyJobs('');
        setAvailableJobs(allJobs);
    }, []);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h2 className="gradient-text">Vendor Portal</h2>
                <div className={styles.stats}>
                    <span>Rank: #1 in Plumbing</span>
                    <span>Win Rate: 24%</span>
                </div>
            </header>

            <main className={styles.grid}>
                {/* Auto-Quote Agent Settings */}
                <section className={`glass-panel ${styles.settingsCard}`}>
                    <h3>🤖 Auto-Quote Agent</h3>
                    <p className={styles.desc}>Configure how your bot responds to new leads.</p>

                    <div className={styles.settingRow}>
                        <label>Status</label>
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
                        <input type="number" defaultValue={25} className={styles.input} />
                    </div>
                </section>

                {/* Live Market Feed */}
                <section className={styles.marketSection}>
                    <h3>Live Opportunity Feed</h3>
                    <div className={styles.feed}>
                        {availableJobs.map(job => (
                            <div key={job.id} className={`glass-panel ${styles.jobCard}`}>
                                <div className={styles.jobHeader}>
                                    <span className={styles.tag}>{job.tags[0]}</span>
                                    <span className={styles.time}>Just Now</span>
                                </div>
                                <h4>{job.title}</h4>
                                <p>{job.location}</p>
                                <div className={styles.botAction}>
                                    {autoQuoteEnabled ? (
                                        <span className={styles.success}>
                                            ✓ Auto-Quoted ${baseRate * 1.2}
                                        </span>
                                    ) : (
                                        <button className={styles.quoteBtn}>Manual Quote</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {availableJobs.length === 0 && <p>No active jobs in your area.</p>}
                    </div>
                </section>
            </main>
        </div>
    );
}
