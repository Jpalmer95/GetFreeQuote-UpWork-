'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, JobCategory } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';

const CATEGORY_COLORS: Record<string, string> = {
    Plumbing:     'linear-gradient(90deg,#4f8ef7,#3b6fd4)',
    Electrical:   'linear-gradient(90deg,#f5a623,#d4860a)',
    HVAC:         'linear-gradient(90deg,#0fd98e,#09b074)',
    Construction: 'linear-gradient(90deg,#9b6dff,#7340e0)',
    Cleaning:     'linear-gradient(90deg,#4fc3f7,#0288d1)',
    'Web Design': 'linear-gradient(90deg,#f06292,#c2185b)',
    Other:        'linear-gradient(90deg,#78909c,#455a64)',
};

export default function Marketplace() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [filters, setFilters] = useState({
        query: '',
        category: '' as JobCategory | '',
        requiresPermit: undefined as boolean | undefined,
        location: ''
    });

    useEffect(() => {
        const timer = setTimeout(async () => {
            const results = await jobService.searchJobs(filters);
            setJobs(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    const categories: JobCategory[] = ['Plumbing', 'Electrical', 'HVAC', 'Construction', 'Cleaning', 'Web Design', 'Other'];

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Category</span>
                        <div className={styles.pillGroup}>
                            <button
                                className={`${styles.pill} ${filters.category === '' ? styles.pillActive : ''}`}
                                onClick={() => setFilters({ ...filters, category: '' })}
                            >
                                All Categories
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`${styles.pill} ${filters.category === cat ? styles.pillActive : ''}`}
                                    onClick={() => setFilters({ ...filters, category: cat })}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Requirements</span>
                        <label className={styles.toggleRow}>
                            <span>Permit Required Only</span>
                            <input
                                type="checkbox"
                                checked={filters.requiresPermit === true}
                                onChange={(e) => setFilters({ ...filters, requiresPermit: e.target.checked ? true : undefined })}
                            />
                        </label>
                    </div>

                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Location</span>
                        <input
                            type="text"
                            placeholder="Filter by city…"
                            className={styles.miniInput}
                            value={filters.location}
                            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                        />
                    </div>
                </aside>

                <main className={styles.feed}>
                    <div className={styles.feedHeader}>
                        <h2>Active Opportunities ({jobs.length})</h2>
                        <select className={styles.sortSelect}>
                            <option>Newest First</option>
                            <option>Highest Budget</option>
                        </select>
                    </div>

                    <div className={styles.grid}>
                        {jobs.map(job => (
                            <div key={job.id} className={`glass-panel ${styles.jobCard}`}>
                                <div
                                    className={styles.cardAccent}
                                    style={{ background: CATEGORY_COLORS[job.category] || CATEGORY_COLORS.Other }}
                                />

                                <div className={styles.cardHeader}>
                                    <span className={styles.categoryTag}>{job.category}</span>
                                    <span className={styles.timeAgo}>Today</span>
                                </div>

                                <h3>{job.title}</h3>
                                <p className={styles.description}>{job.description}</p>

                                <div className={styles.metaRow}>
                                    <span className={styles.metaChip}>
                                        📍 {job.location}
                                    </span>
                                    {job.budget && (
                                        <span className={styles.metaChip}>
                                            💰 {job.budget}
                                        </span>
                                    )}
                                    {job.requiresPermit && (
                                        <span className={`${styles.metaChip} ${styles.metaChipWarn}`}>
                                            ⚠ Permit Req.
                                        </span>
                                    )}
                                </div>

                                <div className={styles.cardActions}>
                                    <button className={styles.bidBtn}>Bid Now</button>
                                    <button className={styles.detailsBtn}>View Details</button>
                                </div>
                            </div>
                        ))}

                        {jobs.length === 0 && (
                            <div className={styles.emptyState}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:0.2}}>
                                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                                </svg>
                                <p>No jobs found matching your filters.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
