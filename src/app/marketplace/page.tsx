'use client';
import { useState, useEffect } from 'react';
import { jobService } from '@/services/jobService';
import { Job, IndustryVertical, KnownIndustryVertical, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES } from '@/types';
import styles from './page.module.css';
import Navbar from '@/components/Navbar';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import SavedSearches from '@/components/SavedSearches';

const URGENCY_LABELS: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This Month',
    within_week: 'This Week',
    urgent: 'Urgent',
};

function estimateDistance(jobLocation: string, searchLocation: string): { miles: number; label: string; tier: 'exact' | 'nearby' | 'region' | 'far' } {
    const jobLoc = jobLocation.toLowerCase().trim();
    const searchLoc = searchLocation.toLowerCase().trim();

    if (jobLoc === searchLoc) {
        return { miles: 0, label: '0 mi', tier: 'exact' };
    }

    const jobParts = jobLoc.split(',').map(p => p.trim()).filter(Boolean);
    const searchParts = searchLoc.split(',').map(p => p.trim()).filter(Boolean);

    const jobCity = jobParts[0] || '';
    const searchCity = searchParts[0] || '';
    const jobState = jobParts[1] || '';
    const searchState = searchParts[1] || '';

    if (jobCity === searchCity) {
        return { miles: 0, label: '0 mi', tier: 'exact' };
    }

    if (jobCity.includes(searchCity) || searchCity.includes(jobCity)) {
        return { miles: 5, label: '~5 mi', tier: 'exact' };
    }

    if (jobState && searchState && jobState === searchState) {
        return { miles: 25, label: '~25 mi', tier: 'nearby' };
    }

    if (jobParts.some(p => searchParts.some(sp => p.includes(sp) || sp.includes(p)))) {
        return { miles: 50, label: '~50 mi', tier: 'region' };
    }

    return { miles: 100, label: '100+ mi', tier: 'far' };
}

function getRelevanceScore(job: Job, query: string, location: string): { score: number; reasons: string[]; distance: { miles: number; label: string; tier: string } | null } {
    const reasons: string[] = [];
    let score = 0;
    let distance: { miles: number; label: string; tier: string } | null = null;

    if (query) {
        const q = query.toLowerCase();
        if (job.title.toLowerCase().includes(q)) { score += 3; reasons.push('Title match'); }
        if (job.tags.some(t => t.toLowerCase().includes(q))) { score += 2; reasons.push('Tag match'); }
        if (job.description.toLowerCase().includes(q)) { score += 1; }
    }

    if (location) {
        distance = estimateDistance(job.location, location);
        if (distance.tier === 'exact') { score += 3; }
        else if (distance.tier === 'nearby') { score += 2; }
        else if (distance.tier === 'region') { score += 1; }
    }

    return { score, reasons, distance };
}

export default function Marketplace() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        query: '',
        industryVertical: '' as IndustryVertical | '',
        subcategory: '',
        requiresPermit: undefined as boolean | undefined,
        location: '',
        tagFilter: '',
        locationRadius: 'any' as string,
    });

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                setError(null);
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

                if (filters.location && filters.locationRadius !== 'any') {
                    const maxMiles = parseInt(filters.locationRadius, 10);
                    if (!isNaN(maxMiles)) {
                        results = results.filter(job => {
                            const dist = estimateDistance(job.location, filters.location);
                            return dist.miles <= maxMiles;
                        });
                    }
                }

                setJobs(results);
            } catch (err) {
                console.error('Marketplace search failed:', err);
                setJobs([]);
                setError('Unable to load projects. The service may be temporarily unavailable — please try again later.');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    const subcategories = filters.industryVertical
        ? (INDUSTRY_SUBCATEGORIES as Record<string, string[]>)[filters.industryVertical] || []
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
                            placeholder="City, state, or zip..."
                            className={styles.miniInput}
                            value={filters.location}
                            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                        />
                        {filters.location && (
                            <select
                                className={styles.radiusSelect}
                                value={filters.locationRadius}
                                onChange={(e) => setFilters({ ...filters, locationRadius: e.target.value })}
                            >
                                <option value="any">Any distance</option>
                                <option value="10">Within 10 miles</option>
                                <option value="25">Within 25 miles</option>
                                <option value="50">Within 50 miles</option>
                                <option value="100">Within 100 miles</option>
                            </select>
                        )}
                    </div>

                    <div className={styles.filterSection}>
                        <SavedSearches
                            currentFilters={filters}
                            onApply={(saved) => setFilters({
                                query: (saved.query as string) || '',
                                industryVertical: (saved.industryVertical as IndustryVertical | '') || '',
                                subcategory: (saved.subcategory as string) || '',
                                requiresPermit: saved.requiresPermit as boolean | undefined,
                                location: (saved.location as string) || '',
                                tagFilter: (saved.tagFilter as string) || '',
                                locationRadius: (saved.locationRadius as string) || 'any',
                            })}
                        />
                    </div>
                </aside>

                <main className={styles.feed}>
                    <SearchAutocomplete
                        value={filters.query}
                        onChange={(val) => setFilters({ ...filters, query: val })}
                        placeholder="Search projects by keyword..."
                    />

                    <div className={styles.feedHeader}>
                        <h2>Active Opportunities ({jobs.length})</h2>
                        <select className={styles.sortSelect}>
                            <option>Newest First</option>
                            <option>Highest Budget</option>
                        </select>
                    </div>

                    {error && (
                        <div className={styles.errorBanner}>
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.grid}>
                        {jobs.map(job => {
                            const hasActiveSearch = !!(filters.query || filters.location);
                            const relevance = hasActiveSearch
                                ? getRelevanceScore(job, filters.query, filters.location)
                                : null;
                            return (
                            <div
                                key={job.id}
                                className={`glass-panel ${styles.jobCard}`}
                            >
                                <div className={styles.cardAccent} />

                                <div className={styles.cardHeader}>
                                    <span className={styles.industryTag}>{job.industryVertical}</span>
                                    {job.communityProjectId && (
                                        <span className={styles.communityTag}>Community Funded</span>
                                    )}
                                    {relevance && relevance.reasons.length > 0 && (
                                        <span className={styles.relevanceBadge}>
                                            {relevance.reasons[0]}
                                        </span>
                                    )}
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
                                    <span className={`${styles.metaChip} ${relevance?.distance?.tier === 'exact' ? styles.metaChipMatch : relevance?.distance?.tier === 'nearby' ? styles.metaChipNear : ''}`}>
                                        {job.location}
                                    </span>
                                    {relevance?.distance && (
                                        <span className={`${styles.metaChip} ${relevance.distance.tier === 'exact' ? styles.metaChipMatch : relevance.distance.tier === 'nearby' ? styles.metaChipNear : ''}`}>
                                            {relevance.distance.label}
                                        </span>
                                    )}
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
                            );
                        })}

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
