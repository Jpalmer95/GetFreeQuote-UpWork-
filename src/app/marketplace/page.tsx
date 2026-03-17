'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, IndustryVertical, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';

const URGENCY_LABELS: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This Month',
    within_week: 'This Week',
    urgent: 'Urgent',
};

export default function Marketplace() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [filters, setFilters] = useState({
        query: '',
        industryVertical: '' as IndustryVertical | '',
        subcategory: '',
        requiresPermit: undefined as boolean | undefined,
        location: '',
        tagFilter: '',
    });

    useEffect(() => {
        const timer = setTimeout(async () => {
            let results = await jobService.searchJobs({
                query: filters.query || undefined,
                industryVertical: filters.industryVertical || undefined,
                subcategory: filters.subcategory || undefined,
                requiresPermit: filters.requiresPermit,
                location: filters.location || undefined,
            });

            if (filters.tagFilter) {
                const tagTerms = filters.tagFilter.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
                results = results.filter(job =>
                    tagTerms.some(term =>
                        job.tags.some(tag => tag.toLowerCase().includes(term))
                    )
                );
            }

            setJobs(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    const subcategories = filters.industryVertical
        ? INDUSTRY_SUBCATEGORIES[filters.industryVertical] || []
        : [];

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Industry</span>
                        <div className={styles.pillGroup}>
                            <button
                                className={`${styles.pill} ${filters.industryVertical === '' ? styles.pillActive : ''}`}
                                onClick={() => setFilters({ ...filters, industryVertical: '', subcategory: '' })}
                            >
                                All Industries
                            </button>
                            {INDUSTRY_VERTICALS.map(v => (
                                <button
                                    key={v}
                                    className={`${styles.pill} ${filters.industryVertical === v ? styles.pillActive : ''}`}
                                    onClick={() => setFilters({ ...filters, industryVertical: v, subcategory: '' })}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {subcategories.length > 0 && (
                        <div className={styles.filterSection}>
                            <span className={styles.filterLabel}>Subcategory</span>
                            <div className={styles.pillGroup}>
                                <button
                                    className={`${styles.pill} ${filters.subcategory === '' ? styles.pillActive : ''}`}
                                    onClick={() => setFilters({ ...filters, subcategory: '' })}
                                >
                                    All
                                </button>
                                {subcategories.map(s => (
                                    <button
                                        key={s}
                                        className={`${styles.pill} ${filters.subcategory === s ? styles.pillActive : ''}`}
                                        onClick={() => setFilters({ ...filters, subcategory: s })}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Tags</span>
                        <input
                            type="text"
                            placeholder="Filter by tags (comma-separated)..."
                            className={styles.miniInput}
                            value={filters.tagFilter}
                            onChange={(e) => setFilters({ ...filters, tagFilter: e.target.value })}
                        />
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
                            placeholder="Filter by city..."
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
                            placeholder="Search projects by keyword..."
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
                            >
                                <div className={styles.cardAccent} />

                                <div className={styles.cardHeader}>
                                    <span className={styles.industryTag}>{job.industryVertical}</span>
                                    <span className={styles.timeAgo}>
                                        {job.urgency && job.urgency !== 'flexible'
                                            ? URGENCY_LABELS[job.urgency]
                                            : 'Today'}
                                    </span>
                                </div>

                                <h3>{job.title}</h3>

                                <div className={styles.tagRow}>
                                    <span className={styles.categoryTag}>{job.subcategory || job.category}</span>
                                    {job.tags.filter(t => t !== job.industryVertical && t !== job.subcategory && t !== job.category).map(t => (
                                        <span key={t} className={styles.categoryTag}>{t}</span>
                                    ))}
                                </div>

                                <p className={styles.description}>{job.description}</p>

                                <div className={styles.metaRow}>
                                    <span className={styles.metaChip}>
                                        {job.location}
                                    </span>
                                    {job.budget && (
                                        <span className={styles.metaChip}>
                                            {job.budget}
                                        </span>
                                    )}
                                    {job.requiresPermit && (
                                        <span className={`${styles.metaChip} ${styles.metaChipWarn}`}>
                                            Permit Req.
                                        </span>
                                    )}
                                    {job.squareFootage && (
                                        <span className={styles.metaChip}>
                                            {job.squareFootage}
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
                                <p>No projects found matching your filters.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
