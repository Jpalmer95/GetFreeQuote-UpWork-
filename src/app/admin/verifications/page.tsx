'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

interface VerificationRequest {
    id: string;
    vendor_profile_id: string;
    status: string;
    documents: string[];
    license_number: string | null;
    insurance_details: string | null;
    notes: string | null;
    admin_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
    vendor_profiles: {
        id: string;
        company_name: string;
        user_id: string;
        contact_email: string;
        license_number: string | null;
        insurance_details: string | null;
        certifications: string[];
        logo_url: string | null;
    };
}

type StatusTab = 'pending' | 'approved' | 'rejected';

export default function AdminVerifications() {
    const { user, profile, isLoading } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [activeTab, setActiveTab] = useState<StatusTab>('pending');
    const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const isAdmin = profile?.role === 'ADMIN';

    const getHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
    }, []);

    const fetchRequests = useCallback(async () => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/verification?action=admin-list&status=${activeTab}`, { headers });
            if (!res.ok) {
                const data = await res.json();
                setReviewError(data.error || 'Failed to load requests');
                setLoadingData(false);
                return;
            }
            const data = await res.json();
            if (data.requests) {
                setRequests(data.requests);
            }
        } catch {
            setReviewError('Failed to load verification requests');
        }
        setLoadingData(false);
    }, [activeTab, getHeaders]);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (!isLoading && user && isAdmin) {
            setLoadingData(true);
            fetchRequests();
        }
    }, [user, isLoading, isAdmin, fetchRequests, router]);

    const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
        setProcessing(requestId);
        setReviewError(null);
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/verification', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'review',
                    requestId,
                    decision,
                    adminNotes: adminNotes[requestId] || '',
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                setReviewError(data.error || 'Failed to process review');
                return;
            }
            await fetchRequests();
        } catch (err) {
            console.error('Review failed:', err);
            setReviewError('Network error — please try again');
        } finally {
            setProcessing(null);
        }
    };

    if (isLoading || !user) {
        return <div className="loading-screen">Loading...</div>;
    }

    if (!isAdmin) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <div className={styles.forbidden}>
                        <div className={styles.forbiddenTitle}>Access Denied</div>
                        <p className={styles.forbiddenText}>This page is only accessible to administrators.</p>
                        <Link href="/dashboard" className={styles.backLink} style={{ marginTop: '1rem', display: 'inline-block' }}>
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.pageHeader}>
                    <h2 className="gradient-text">Verification Requests</h2>
                    <Link href="/dashboard" className={styles.backLink}>Back to Dashboard</Link>
                </div>

                <div className={styles.tabBar}>
                    {(['pending', 'approved', 'rejected'] as StatusTab[]).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {reviewError && (
                    <div style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {reviewError}
                    </div>
                )}

                {loadingData ? (
                    <div className={styles.emptyState}>Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div className={styles.emptyState}>
                        No {activeTab} verification requests.
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.id} className={`glass-panel ${styles.requestCard}`}>
                            <div className={styles.requestHeader}>
                                <div className={styles.companyInfo}>
                                    {req.vendor_profiles.logo_url ? (
                                        <img src={req.vendor_profiles.logo_url} alt="" className={styles.companyLogo} />
                                    ) : (
                                        <div className={styles.companyInitial}>
                                            {req.vendor_profiles.company_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className={styles.companyName}>{req.vendor_profiles.company_name}</div>
                                        <div className={styles.companyEmail}>{req.vendor_profiles.contact_email}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={`${styles.statusBadge} ${
                                        req.status === 'approved' ? styles.statusApproved :
                                        req.status === 'rejected' ? styles.statusRejected :
                                        styles.statusPending
                                    }`}>
                                        {req.status}
                                    </span>
                                    <div className={styles.requestDate}>
                                        {new Date(req.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailGrid}>
                                {(req.license_number || req.vendor_profiles.license_number) && (
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>License Number</span>
                                        <span className={styles.detailValue}>
                                            {req.license_number || req.vendor_profiles.license_number}
                                        </span>
                                    </div>
                                )}
                                {(req.insurance_details || req.vendor_profiles.insurance_details) && (
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Insurance</span>
                                        <span className={styles.detailValue}>
                                            {req.insurance_details || req.vendor_profiles.insurance_details}
                                        </span>
                                    </div>
                                )}
                                {req.vendor_profiles.certifications.length > 0 && (
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Certifications</span>
                                        <span className={styles.detailValue}>
                                            {req.vendor_profiles.certifications.join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {req.documents.length > 0 && (
                                <div className={styles.documentsSection}>
                                    <div className={styles.docLabel}>Submitted Documents</div>
                                    <div className={styles.docList}>
                                        {req.documents.filter(doc => {
                                            try { return new URL(doc).protocol === 'https:'; } catch { return false; }
                                        }).map((doc, i) => (
                                            <a
                                                key={i}
                                                href={doc}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.docLink}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                Document {i + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {req.notes && (
                                <div className={styles.notesSection}>
                                    <div className={styles.docLabel}>Vendor Notes</div>
                                    <p className={styles.notesText}>{req.notes}</p>
                                </div>
                            )}

                            {req.admin_notes && req.status !== 'pending' && (
                                <div className={styles.notesSection}>
                                    <div className={styles.docLabel}>Admin Notes</div>
                                    <p className={styles.notesText}>{req.admin_notes}</p>
                                </div>
                            )}

                            {req.reviewed_at && (
                                <div className={styles.reviewInfo}>
                                    Reviewed on {new Date(req.reviewed_at).toLocaleDateString()}
                                </div>
                            )}

                            {req.status === 'pending' && (
                                <div className={styles.reviewActions}>
                                    <input
                                        type="text"
                                        className={styles.adminNotesInput}
                                        placeholder="Admin notes (optional)..."
                                        value={adminNotes[req.id] || ''}
                                        onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                    />
                                    <button
                                        className={styles.approveBtn}
                                        onClick={() => handleReview(req.id, 'approved')}
                                        disabled={processing === req.id}
                                    >
                                        {processing === req.id ? 'Processing...' : 'Approve'}
                                    </button>
                                    <button
                                        className={styles.rejectBtn}
                                        onClick={() => handleReview(req.id, 'rejected')}
                                        disabled={processing === req.id}
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
