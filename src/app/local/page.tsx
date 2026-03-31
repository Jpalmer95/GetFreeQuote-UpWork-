'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Job, INDUSTRY_VERTICALS, INDUSTRY_SUBCATEGORIES, KnownIndustryVertical, ProjectUrgency } from '@/types';
import Navbar from '@/components/Navbar';
import LocationResolver, { ResolvedLocation } from '@/components/LocationResolver';
import styles from './page.module.css';

const URGENCY_LABELS: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This Month',
    within_week: 'This Week',
    urgent: 'Urgent',
};


interface LocalJob extends Job {
    distanceMiles?: number;
}

const PAGE_SIZE = 12;

export default function GoLocal() {
    const { user } = useAuth();
    const router = useRouter();

    const [viewerLocation, setViewerLocation] = useState<ResolvedLocation | null>(null);
    const [jobs, setJobs] = useState<LocalJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [viewRadius, setViewRadius] = useState(25);
    const [industryFilter, setIndustryFilter] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('');
    const loaderRef = useRef<HTMLDivElement | null>(null);

    const loadJobs = useCallback(async (reset: boolean = false) => {
        setLoading(true);
        setError(null);

        const offset = reset ? 0 : page * PAGE_SIZE;

        // When viewer has a location, use the haversine_miles SQL function to filter
        // and order globally by distance — this ensures distance sort is consistent
        // across pages, not just within each fetched page.
        if (viewerLocation) {
            let rpcQuery = supabase
                .rpc('local_jobs_by_distance', {
                    viewer_lat: viewerLocation.lat,
                    viewer_lng: viewerLocation.lng,
                    radius_filter: viewRadius,
                    industry_filter: industryFilter || null,
                    urgency_filter: urgencyFilter || null,
                    page_offset: offset,
                    page_limit: PAGE_SIZE,
                });

            const { data, error: dbErr } = await rpcQuery;

            if (dbErr) {
                // Fallback: RPC may not exist yet in dev DB; load without distance ordering
                setError('Location-based sort unavailable. Showing recent local requests.');
                setLoading(false);
                return;
            }

            const rows: LocalJob[] = (data || []).map((row: Record<string, unknown>) => ({
                id: row.id as string,
                userId: row.user_id as string,
                title: row.title as string,
                category: row.category as string,
                description: row.description as string,
                location: row.location as string,
                status: row.status as string,
                createdAt: row.created_at as string,
                tags: (row.tags as string[]) || [],
                isPublic: row.is_public as boolean,
                requiresPermit: row.requires_permit as boolean,
                budget: (row.budget as string) || undefined,
                industryVertical: (row.industry_vertical as string) || 'Other',
                subcategory: (row.subcategory as string) || 'Other',
                urgency: ((row.urgency as string) || 'flexible') as ProjectUrgency,
                isLocalRequest: row.is_local_request as boolean,
                locationLat: row.location_lat as number | undefined,
                locationLng: row.location_lng as number | undefined,
                radiusMiles: row.radius_miles as number | undefined,
                distanceMiles: row.distance_miles as number | undefined,
            }));

            if (reset) {
                setJobs(rows);
                setPage(1);
            } else {
                setJobs(prev => [...prev, ...rows]);
                setPage(p => p + 1);
            }
            setHasMore((data?.length ?? 0) === PAGE_SIZE);
            setLoading(false);
            return;
        }

        // No viewer location — order by created_at descending
        let query = supabase
            .from('jobs')
            .select('*')
            .eq('is_local_request', true)
            .eq('status', 'OPEN')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1);

        if (industryFilter) query = query.eq('industry_vertical', industryFilter);
        if (urgencyFilter) query = query.eq('urgency', urgencyFilter);

        const { data, error: dbErr } = await query;

        if (dbErr) {
            setError('Could not load local requests. Please try again.');
            setLoading(false);
            return;
        }

        const rows: LocalJob[] = (data || []).map(row => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            category: row.category,
            description: row.description,
            location: row.location,
            status: row.status,
            createdAt: row.created_at,
            tags: row.tags || [],
            isPublic: row.is_public,
            requiresPermit: row.requires_permit,
            budget: row.budget || undefined,
            industryVertical: row.industry_vertical || 'Other',
            subcategory: row.subcategory || 'Other',
            urgency: (row.urgency || 'flexible') as ProjectUrgency,
            isLocalRequest: row.is_local_request,
            locationLat: row.location_lat,
            locationLng: row.location_lng,
            radiusMiles: row.radius_miles,
        }));

        if (reset) {
            setJobs(rows);
            setPage(1);
        } else {
            setJobs(prev => [...prev, ...rows]);
            setPage(p => p + 1);
        }
        setHasMore(data?.length === PAGE_SIZE);
        setLoading(false);
    }, [page, viewerLocation, viewRadius, industryFilter, urgencyFilter]);

    useEffect(() => {
        loadJobs(true);
    }, [viewerLocation, viewRadius, industryFilter, urgencyFilter]);

    useEffect(() => {
        if (!loaderRef.current || !hasMore) return;
        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !loading) loadJobs(false);
        }, { rootMargin: '200px' });
        obs.observe(loaderRef.current);
        return () => obs.disconnect();
    }, [loaderRef, hasMore, loading, loadJobs]);

    const subcats = industryFilter
        ? (INDUSTRY_SUBCATEGORIES as Record<string, string[]>)[industryFilter] || []
        : [];

    return (
        <div className={styles.container}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.heroSection}>
                    <div className={styles.eyebrow}>
                        <span className={styles.liveDot} />
                        Hyperlocal · Same-Day Tasks
                    </div>
                    <h1 className={styles.headline}>
                        <span className="gradient-text">Go Local</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Find nearby gigs and urgent tasks posted by people in your area — tire changes, baker coverage, handyman jobs, and more.
                    </p>
                </div>

                <div className={`glass-panel ${styles.locationCard}`}>
                    <div className={styles.locationHeader}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>{viewerLocation ? `Showing jobs within ${viewRadius} mi of ${viewerLocation.label}` : 'Set your location to find nearby jobs'}</span>
                    </div>
                    <LocationResolver value={viewerLocation} onChange={setViewerLocation} />

                    {viewerLocation && (
                        <div className={styles.radiusRow}>
                            <label>Radius: <strong>{viewRadius} mi</strong></label>
                            <input
                                type="range"
                                min={1}
                                max={50}
                                value={viewRadius}
                                onChange={e => setViewRadius(Number(e.target.value))}
                                className={styles.radiusSlider}
                            />
                        </div>
                    )}
                </div>

                <div className={styles.filtersRow}>
                    <select
                        className={styles.filterSelect}
                        value={industryFilter}
                        onChange={e => setIndustryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {INDUSTRY_VERTICALS.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>

                    <select
                        className={styles.filterSelect}
                        value={urgencyFilter}
                        onChange={e => setUrgencyFilter(e.target.value)}
                    >
                        <option value="">Any Urgency</option>
                        <option value="urgent">Urgent / ASAP</option>
                        <option value="within_week">This Week</option>
                        <option value="within_month">This Month</option>
                        <option value="flexible">Flexible</option>
                    </select>

                    {subcats.length > 0 && (
                        <span className={styles.subcatNote}>{industryFilter} selected</span>
                    )}
                </div>

                {error && (
                    <div className={styles.errorBanner}>{error}</div>
                )}

                {!viewerLocation && (
                    <div className={styles.noLocationHint}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <p>Set your location above to see distance badges and sort by nearest first.</p>
                        <p className={styles.hint}>All local requests are still shown below — set location to filter by distance.</p>
                    </div>
                )}

                <div className={styles.feedHeader}>
                    <h2>Local Requests {jobs.length > 0 ? `(${jobs.length}${hasMore ? '+' : ''})` : ''}</h2>
                    {viewerLocation && <span className={styles.sortNote}>Sorted by distance</span>}
                </div>

                <div className={styles.grid}>
                    {jobs.map(job => (
                        <div key={job.id} className={`glass-panel ${styles.jobCard}`}>
                            <div className={styles.cardAccent} />
                            <div className={styles.cardHeader}>
                                <span className={styles.localBadge}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {job.distanceMiles != null
                                        ? `Local · ${job.distanceMiles < 1 ? '<1' : job.distanceMiles.toFixed(1)} mi`
                                        : 'Local'}
                                </span>
                                <span className={styles.industryTag}>{job.industryVertical}</span>
                                {job.urgency && job.urgency !== 'flexible' && (
                                    <span className={`${styles.urgencyBadge} ${job.urgency === 'urgent' ? styles.urgent : ''}`}>
                                        {URGENCY_LABELS[job.urgency]}
                                    </span>
                                )}
                            </div>

                            <h3 className={styles.jobTitle}>{job.title}</h3>

                            <div className={styles.tagRow}>
                                <span className={styles.catTag}>{job.subcategory || job.category}</span>
                                {job.radiusMiles && (
                                    <span className={styles.radiusTag}>{job.radiusMiles} mi radius</span>
                                )}
                            </div>

                            <p className={styles.description}>{job.description}</p>

                            <div className={styles.metaRow}>
                                <span className={styles.metaChip}>{job.location}</span>
                                {job.budget && <span className={styles.metaChip}>{job.budget}</span>}
                            </div>

                            <div className={styles.cardActions}>
                                <button
                                    className={styles.bidBtn}
                                    onClick={() => {
                                        if (!user) router.push(`/login?redirect=${encodeURIComponent(`/jobs/${job.id}`)}`);
                                        else router.push(`/jobs/${job.id}`);
                                    }}
                                >
                                    Bid Now
                                </button>
                                <button className={styles.detailsBtn} onClick={() => router.push(`/jobs/${job.id}`)}>
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}

                    {!loading && jobs.length === 0 && (
                        <div className={styles.emptyState}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            <p>No local requests found{viewerLocation ? ` within ${viewRadius} miles` : ''}.</p>
                            <p className={styles.hint}>
                                {viewerLocation ? 'Try expanding your search radius or changing filters.' : 'Be the first to post a local request!'}
                            </p>
                        </div>
                    )}
                </div>

                {loading && (
                    <div className={styles.loadingRow}>
                        <span className={styles.spinner} />
                        <span>Loading nearby jobs...</span>
                    </div>
                )}

                <div ref={loaderRef} style={{ height: 1 }} />
            </main>
        </div>
    );
}
