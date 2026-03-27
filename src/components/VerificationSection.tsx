'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import FileUpload from '@/components/FileUpload';
import styles from './VerificationSection.module.css';

interface VerificationSectionProps {
    userId: string;
    profileId: string;
}

interface VerificationStatus {
    status: string;
    profileId?: string;
    request?: {
        id: string;
        status: string;
        adminNotes: string | null;
        createdAt: string;
        reviewedAt: string | null;
    };
}

export default function VerificationSection({ userId, profileId }: VerificationSectionProps) {
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [documents, setDocuments] = useState<string[]>([]);
    const [licenseNumber, setLicenseNumber] = useState('');
    const [insuranceDetails, setInsuranceDetails] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const getHeaders = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/verification?action=my-status', { headers });
            const data = await res.json();
            setVerificationStatus(data);
        } catch {
            console.error('Failed to fetch verification status');
        }
    }, [getHeaders]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (documents.length === 0 && !licenseNumber.trim() && !insuranceDetails.trim()) {
            setError('Please provide at least one document, license number, or insurance details.');
            return;
        }

        setSubmitting(true);
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/verification', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'submit',
                    documents,
                    licenseNumber: licenseNumber.trim() || undefined,
                    insuranceDetails: insuranceDetails.trim() || undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to submit verification request');
                return;
            }
            setSuccess('Verification request submitted! We will review it shortly.');
            setDocuments([]);
            setLicenseNumber('');
            setInsuranceDetails('');
            setNotes('');
            await fetchStatus();
        } catch {
            setError('Failed to submit verification request');
        } finally {
            setSubmitting(false);
        }
    };

    if (!verificationStatus || verificationStatus.status === 'no_profile') return null;

    if (verificationStatus.status === 'verified') {
        return (
            <div className={`glass-panel ${styles.card}`}>
                <div className={styles.cardTitle}>
                    <span className={styles.verifiedIcon}>✓</span>
                    Verification Status
                </div>
                <div className={styles.verifiedBanner}>
                    <span className={styles.verifiedBadgeLarge}>✓ Verified</span>
                    <p className={styles.verifiedText}>
                        Your company is verified. The verified badge is displayed on your profile, quotes, and marketplace listings.
                    </p>
                </div>
            </div>
        );
    }

    if (verificationStatus.status === 'pending') {
        return (
            <div className={`glass-panel ${styles.card}`}>
                <div className={styles.cardTitle}>Verification Status</div>
                <div className={styles.pendingBanner}>
                    <span className={styles.pendingBadge}>⏳ Under Review</span>
                    <p className={styles.pendingText}>
                        Your verification request is being reviewed. Submitted on{' '}
                        {verificationStatus.request
                            ? new Date(verificationStatus.request.createdAt).toLocaleDateString()
                            : 'recently'}
                        . You will be notified once reviewed.
                    </p>
                </div>
            </div>
        );
    }

    const isResubmit = verificationStatus.status === 'rejected';

    return (
        <div className={`glass-panel ${styles.card}`}>
            <div className={styles.cardTitle}>
                {isResubmit ? 'Resubmit Verification' : 'Get Verified'}
            </div>
            <div className={styles.cardDesc}>
                {isResubmit
                    ? 'Your previous request was not approved. Please update your documents and resubmit.'
                    : 'Earn a trusted badge by verifying your business credentials. Upload supporting documents to get started.'}
            </div>

            {isResubmit && verificationStatus.request?.adminNotes && (
                <div className={styles.rejectionNotice}>
                    <strong>Reviewer feedback:</strong> {verificationStatus.request.adminNotes}
                </div>
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}
            {success && <div className={styles.successMsg}>{success}</div>}

            <div className={styles.requirements}>
                <div className={styles.reqTitle}>Accepted documents:</div>
                <ul className={styles.reqList}>
                    <li>Business license or registration</li>
                    <li>Proof of insurance (certificate of insurance)</li>
                    <li>Professional certifications</li>
                    <li>Government-issued trade license</li>
                </ul>
            </div>

            <div className={styles.formSection}>
                <label className={styles.label}>Verification Documents</label>
                <FileUpload
                    bucket="vendor-assets"
                    userId={userId}
                    maxFiles={5}
                    acceptPdf
                    existingUrls={documents}
                    hint="Upload business license, insurance certificates, or other credentials"
                    onUpload={(urls) => setDocuments(urls)}
                />
            </div>

            <div className={styles.formGrid}>
                <div className={styles.formSection}>
                    <label className={styles.label}>License Number</label>
                    <input
                        className={styles.input}
                        value={licenseNumber}
                        onChange={e => setLicenseNumber(e.target.value)}
                        placeholder="e.g. LIC-12345"
                    />
                </div>
                <div className={styles.formSection}>
                    <label className={styles.label}>Insurance Details</label>
                    <input
                        className={styles.input}
                        value={insuranceDetails}
                        onChange={e => setInsuranceDetails(e.target.value)}
                        placeholder="e.g. General Liability, $1M coverage"
                    />
                </div>
            </div>

            <div className={styles.formSection}>
                <label className={styles.label}>Additional Notes</label>
                <textarea
                    className={styles.textarea}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any additional information to support your verification..."
                    rows={3}
                />
            </div>

            <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={submitting}
            >
                {submitting ? 'Submitting...' : isResubmit ? 'Resubmit for Verification' : 'Submit for Verification'}
            </button>
        </div>
    );
}
