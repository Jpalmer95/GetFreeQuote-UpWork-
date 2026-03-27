'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './RecommendedVendors.module.css';

interface Vendor {
    id: string;
    company_name: string;
    company_description: string;
    industries: string[];
    specialties: string[];
    service_areas: string[];
    is_verified: boolean;
    avg_rating: number;
    total_reviews: number;
    logo_url?: string;
    score: number;
}

export default function RecommendedVendors({ jobId }: { jobId: string }) {
    const { session } = useAuth();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.access_token) { setLoading(false); return; }
        const load = async () => {
            try {
                const res = await fetch(`/api/recommendations?jobId=${jobId}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setVendors(data);
                }
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [jobId, session?.access_token]);

    if (loading) return null;
    if (vendors.length === 0) return null;

    return (
        <div className={styles.container}>
            <h4 className={styles.heading}>Recommended Vendors</h4>
            <div className={styles.list}>
                {vendors.map(v => (
                    <div key={v.id} className={styles.card}>
                        <div className={styles.cardTop}>
                            {v.logo_url ? (
                                <img src={v.logo_url} alt="" className={styles.logo} />
                            ) : (
                                <div className={styles.logoPlaceholder}>
                                    {v.company_name.charAt(0)}
                                </div>
                            )}
                            <div className={styles.info}>
                                <span className={styles.name}>
                                    {v.company_name}
                                    {v.is_verified && (
                                        <span className={styles.verifiedBadge}>✓</span>
                                    )}
                                </span>
                                <span className={styles.rating}>
                                    {'★'.repeat(Math.round(v.avg_rating))}{'☆'.repeat(5 - Math.round(v.avg_rating))}
                                    <span className={styles.reviewCount}>({v.total_reviews})</span>
                                </span>
                            </div>
                            <span className={styles.matchScore}>{v.score}% match</span>
                        </div>
                        {v.specialties.length > 0 && (
                            <div className={styles.tags}>
                                {v.specialties.slice(0, 3).map(s => (
                                    <span key={s} className={styles.tag}>{s}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
