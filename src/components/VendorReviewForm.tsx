'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface VendorReviewFormProps {
    vendorProfileId: string;
    onSubmitted?: () => void;
}

export default function VendorReviewForm({ vendorProfileId, onSubmitted }: VendorReviewFormProps) {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    if (!user) {
        return (
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.5rem' }}>
                Sign in to leave a review.
            </p>
        );
    }

    const submit = async () => {
        if (rating === 0) {
            setMessage({ ok: false, text: 'Please select a star rating.' });
            return;
        }
        setSubmitting(true);
        setMessage(null);
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendorProfileId, rating, comment: comment.trim() }),
            });
            const json = await res.json();
            if (!json.success) {
                setMessage({ ok: false, text: json.error || 'Could not submit review.' });
            } else {
                setMessage({ ok: true, text: 'Thanks for your review!' });
                setRating(0);
                setComment('');
                if (onSubmitted) onSubmitted();
            }
        } catch (e: any) {
            setMessage({ ok: false, text: e.message || 'Could not submit review.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: '1rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Leave a review</div>

            <div style={{ display: 'flex', gap: '0.25rem', fontSize: '1.5rem', marginBottom: '0.75rem' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 'inherit',
                            padding: '0 2px',
                            color: (hoverRating || rating) >= n ? '#fbbf24' : 'rgba(255,255,255,0.25)',
                        }}
                    >
                        ★
                    </button>
                ))}
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
                style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'inherit',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    marginBottom: '0.75rem',
                }}
            />

            <button
                type="button"
                disabled={submitting}
                onClick={submit}
                style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: submitting ? 'default' : 'pointer',
                    background: 'var(--primary, #4f8cff)',
                    color: '#fff',
                    fontWeight: 600,
                    opacity: submitting ? 0.6 : 1,
                }}
            >
                {submitting ? 'Submitting…' : 'Submit Review'}
            </button>

            {message && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: message.ok ? '#4ade80' : '#f87171' }}>
                    {message.text}
                </p>
            )}
        </div>
    );
}
