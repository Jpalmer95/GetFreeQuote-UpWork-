'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, JobCategory } from '@/types';
import styles from './page.module.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Marketplace() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [filters, setFilters] = useState({
        query: '',
        category: '' as JobCategory | '',
        requiresPermit: undefined as boolean | undefined,
        location: ''
    });

    // Debounced search effect
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
            {/* Header / Nav */}
            <Navbar />

            <div className={styles.layout}>
                {/* Sidebar Filters */}
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <h3>Category</h3>
                        <div className={styles.checkboxGroup}>
                            <label className={filters.category === '' ? styles.activeFilter : ''}>
                                <input
                                    type="radio"
                                    name="category"
                                    checked={filters.category === ''}
                                    onChange={() => setFilters({ ...filters, category: '' })}
                                /> All
                            </label>
                            {categories.map(cat => (
                                <label key={cat} className={filters.category === cat ? styles.activeFilter : ''}>
                                    <input
                                        type="radio"
                                        name="category"
                                        checked={filters.category === cat}
                                        onChange={() => setFilters({ ...filters, category: cat })}
                                    /> {cat}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterSection}>
                        <h3>Requirements</h3>
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
                        <h3>Location</h3>
                        <input
                            type="text"
                            placeholder="Filter by City..."
                            className={styles.miniInput}
                            value={filters.location}
                            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                        />
                    </div>
                </aside>

                {/* Main Feed */}
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
                                <div className={styles.cardHeader}>
                                    <span className={styles.categoryTag}>{job.category}</span>
                                    <span className={styles.timeAgo}>Today</span>
                                </div>

                                <h3>{job.title}</h3>
                                <p className={styles.description}>{job.description}</p>

                                <div className={styles.metaGrid}>
                                    <div className={styles.metaItem}>
                                        <span>📍</span> {job.location}
                                    </div>
                                    {job.budget && (
                                        <div className={styles.metaItem}>
                                            <span>💰</span> {job.budget}
                                        </div>
                                    )}
                                    {job.requiresPermit && (
                                        <div className={styles.metaItem} style={{ color: '#fbbf24' }}>
                                            <span>⚠️</span> Permit Req.
                                        </div>
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
                                <p>No jobs found matching your filters.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
