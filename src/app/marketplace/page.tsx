'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, JobCategory } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';


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
                    <div className={styles.searchBar}>
                        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                            type="text"
                            placeholder="Search jobs by keyword…"
                            className={styles.searchInput}
                            value={filters.query}
                            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                        />
                    </div>

                    <div className={styles.feedHeader}>
                        <h2>Active Opportunities ({jobs.length})</h2>
                        <select className={styles.sortSelect}>
                            <option>Newest First</option>
                            <option>Highest Budget</option>
                        </select>
                    </div>

                    <div className={styles.grid}>
                        {jobs.map(job => (
                            <div
                                key={job.id}
                                className={`glass-panel ${styles.jobCard}`}
                                data-category={job.category}
                            >
                                <div className={styles.cardAccent} />

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
                                <svg className={styles.emptyIcon} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
