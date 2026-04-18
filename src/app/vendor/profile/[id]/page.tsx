'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { VendorProfile, VendorReview } from '@/types';
import { db } from '@/services/db';
import Navbar from '@/components/Navbar';
import TrustScoreBadge from '@/components/TrustScoreBadge';
import { calculateTrustScore } from '@/services/trustScore';
import { TrustScoreBreakdown } from '@/types';
import styles from './page.module.css';

export default function PublicVendorProfile({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [reviews, setReviews] = useState<VendorReview[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const p = await db.getVendorProfileById(id);
            if (p) {
                const r = await db.getVendorReviews(p.id);
                setProfile(p);
                setReviews(r);
            }
            setLoading(false);
        };
        load();
    }, [id]);

    if (loading) return <div className="loading-screen">Loading...</div>;

    if (!profile) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.notFound}>
                        <div className={styles.notFoundTitle}>Vendor not found</div>
                        <Link href="/marketplace" className={styles.backLink}>Browse Marketplace</Link>
                    </div>
                </div>
            </div>
        );
    }

    const renderStars = (rating: number) => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <Link href="/marketplace" className={styles.backLink}>Back to Marketplace</Link>

                <div className={styles.profileHeader}>
                    <div className={styles.avatar}>
                        {profile.logoUrl
                            ? <img src={profile.logoUrl} alt={profile.companyName} />
                            : profile.companyName.charAt(0).toUpperCase()
                        }
                    </div>
                    <div className={styles.headerInfo}>
                        <h1 className={styles.companyName}>{profile.companyName}</h1>
                        <div className={styles.meta}>
                            {profile.yearEstablished && (
                                <span className={styles.metaItem}>
                                    <span className={styles.metaLabel}>Est.</span>{profile.yearEstablished}
                                </span>
                            )}
                            <span className={styles.metaItem}>
                                <span className={styles.metaLabel}>Team</span>{profile.teamSize} {profile.teamSize === 1 ? 'person' : 'people'}
                            </span>
                            {profile.serviceAreas.length > 0 && (
                                <span className={styles.metaItem}>
                                    <span className={styles.metaLabel}>Serves</span>{profile.serviceAreas.join(', ')}
                                </span>
                            )}
                        </div>
                        <div className={styles.badges}>
                            {profile.isVerified && <span className={styles.verifiedBadge}>Verified</span>}
                            {profile.avgRating !== undefined && profile.avgRating > 0 && (
                                <span className={styles.ratingBadge}>
                                    {renderStars(profile.avgRating)} {profile.avgRating.toFixed(1)} ({profile.totalReviews})
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {profile.companyDescription && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>About</div>
                        <p className={styles.description}>{profile.companyDescription}</p>
                    </div>
                )}

                {profile.industries.length > 0 && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Industries</div>
                        <div className={styles.tagList}>
                            {profile.industries.map(ind => <span key={ind} className={styles.tag}>{ind}</span>)}
                        </div>
                    </div>
                )}

                {profile.specialties.length > 0 && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Specialties</div>
                        <div className={styles.tagList}>
                            {profile.specialties.map(s => <span key={s} className={styles.tag}>{s}</span>)}
                        </div>
                    </div>
                )}

                {profile.certifications.length > 0 && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Certifications</div>
                        <div className={styles.tagList}>
                            {profile.certifications.map(c => <span key={c} className={styles.tag}>{c}</span>)}
                        </div>
                    </div>
                )}

                {(profile.insuranceDetails || profile.licenseNumber) && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Licensing & Insurance</div>
                        <div className={styles.detailGrid}>
                            {profile.licenseNumber && (
                                <div className={styles.detailItem}>
                                    <span className={styles.detailLabel}>License</span>
                                    <span className={styles.detailValue}>{profile.licenseNumber}</span>
                                </div>
                            )}
                            {profile.insuranceDetails && (
                                <div className={styles.detailItem}>
                                    <span className={styles.detailLabel}>Insurance</span>
                                    <span className={styles.detailValue}>{profile.insuranceDetails}</span>
                                </div>
                            )}
                            {profile.insuranceExpiry && (
                                <div className={styles.detailItem}>
                                    <span className={styles.detailLabel}>Expires</span>
                                    <span className={styles.detailValue}>{new Date(profile.insuranceExpiry).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {profile.portfolioImages.length > 0 && (
                    <div className={`glass-panel ${styles.card}`}>
                        <div className={styles.cardTitle}>Portfolio</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                            {profile.portfolioImages.map((img, i) => (
                                <div key={i} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                                    <img src={img} alt={profile.portfolioDescriptions[i] || 'Portfolio item'}
                                        style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                                    {profile.portfolioDescriptions[i] && (
                                        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                            {profile.portfolioDescriptions[i]}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Contact</div>
                    <div className={styles.detailGrid}>
                        {profile.contactEmail && (
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Email</span>
                                <span className={styles.detailValue}>{profile.contactEmail}</span>
                            </div>
                        )}
                        {profile.contactPhone && (
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Phone</span>
                                <span className={styles.detailValue}>{profile.contactPhone}</span>
                            </div>
                        )}
                        {profile.website && (
                            <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Website</span>
                                <span className={styles.detailValue}>
                                    <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)' }}>
                                        {profile.website}
                                    </a>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardTitle}>Reviews ({reviews.length})</div>
                    {reviews.length === 0 ? (
                        <p className={styles.emptyMsg}>No reviews yet</p>
                    ) : (
                        reviews.map(review => (
                            <div key={review.id} className={styles.reviewCard}>
                                <div className={styles.reviewHeader}>
                                    <span className={styles.reviewerName}>{review.reviewerName}</span>
                                    <span className={styles.stars}>{renderStars(review.rating)}</span>
                                </div>
                                <p className={styles.reviewComment}>{review.comment}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
