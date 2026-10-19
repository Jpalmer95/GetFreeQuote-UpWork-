'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { Job, Quote } from '@/types';
import { db } from '@/services/db';
import styles from './page.module.css';

const URGENCY: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This month',
    within_week: 'This week',
    urgent: 'Urgent',
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [job, setJob] = useState<Job | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [myQuote, setMyQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [amount, setAmount] = useState('');
    const [days, setDays] = useState('1');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const j = await db.getJob(id);
        if (!j) {
            setJob(null);
            setLoading(false);
            return;
        }
        setJob(j);
        const qs = await db.getQuotes(id);
        setQuotes(qs);
        if (user) setMyQuote(qs.find(q => q.vendorId === user.id) || null);
        setLoading(false);
    }, [id, user]);

    useEffect(() => { load(); }, [load]);

    const isOwner = !!(user && job && user.id === job.userId);
    const canBid = !!(user && job && job.status === 'OPEN' && !isOwner && !myQuote);

    const submitQuote = async () => {
        if (!session) {
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`);
            return;
        }
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
            setFormMsg({ ok: false, text: 'Enter a positive quote amount.' });
            return;
        }
        if (!details.trim()) {
            setFormMsg({ ok: false, text: 'Describe what is included (scope, materials, exclusions).' });
            return;
        }
        setSubmitting(true);
        setFormMsg(null);
        try {
            const res = await fetch('/api/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    jobId: id,
                    amount: n,
                    estimatedDays: Math.max(1, Number(days) || 1),
                    details: details.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setFormMsg({ ok: false, text: json.error || 'Could not submit quote.' });
            } else {
                setFormMsg({ ok: true, text: 'Quote submitted. The owner will see it in their inbox.' });
                setAmount('');
                setDetails('');
                await load();
            }
        } catch (e: unknown) {
            setFormMsg({ ok: false, text: e instanceof Error ? e.message : 'Network error' });
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading || loading) return <div className="loading-screen">Loading...</div>;

    if (!job) {
        return (
            <div className={styles.container}>
                <Navbar />
                <main className={styles.main}>
                    <p className={styles.muted}>Job not found or no longer public.</p>
                    <Link href="/marketplace" className="btn-secondary">Browse marketplace</Link>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <main className={styles.main}>
                <Link href="/marketplace" className={styles.back}>← Marketplace</Link>
                {error && <p className={styles.error}>{error}</p>}

                <header className={`glass-panel ${styles.header}`}>
                    <div className={styles.chips}>
                        <span className="badge badge-blue">{job.industryVertical}</span>
                        <span className="badge">{job.subcategory || job.category}</span>
                        {job.workKind === 'bounty' && <span className="badge badge-amber">Bounty</span>}
                        {job.isLocalRequest && <span className="badge badge-green">Nearby / JIT</span>}
                        {job.urgency && job.urgency !== 'flexible' && (
                            <span className={`badge ${job.urgency === 'urgent' ? 'badge-amber' : ''}`}>
                                {URGENCY[job.urgency]}
                            </span>
                        )}
                        <span className="badge badge-muted">{job.status}</span>
                    </div>
                    <h1>{job.title}</h1>
                    <p className={styles.meta}>
                        {job.location}
                        {job.budget ? ` · Budget ${job.budget}` : ''}
                        {job.squareFootage ? ` · ${job.squareFootage}` : ''}
                    </p>
                    <p className={styles.body}>{job.description}</p>
                    {job.materials && <p className={styles.muted}>Materials: {job.materials}</p>}
                    {(job.timelineStart || job.timelineEnd) && (
                        <p className={styles.muted}>
                            Window: {job.timelineStart || 'TBD'} → {job.timelineEnd || 'TBD'}
                        </p>
                    )}
                    {job.attachments && job.attachments.length > 0 && (
                        <div className={styles.atts}>
                            {job.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.att}>
                                    Attachment {i + 1}
                                </a>
                            ))}
                        </div>
                    )}
                </header>

                {isOwner && (
                    <section className={`glass-panel ${styles.card}`}>
                        <h2>Your listing</h2>
                        <p className={styles.muted}>{quotes.length} quote{quotes.length === 1 ? '' : 's'} so far. Edit, cancel, or award from your desk.</p>
                        <div className={styles.row}>
                            <Link href="/dashboard" className="btn-primary">Manage on dashboard</Link>
                        </div>
                    </section>
                )}

                {canBid && (
                    <section className={`glass-panel ${styles.card}`}>
                        <h2>Submit a quote</h2>
                        <p className={styles.muted}>
                            One bid per vendor. Include what is in / out of scope so the owner can compare apples-to-apples.
                        </p>
                        <div className={styles.row}>
                            <label>
                                Amount (USD)
                                <input className="field-input" type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} />
                            </label>
                            <label>
                                Estimated days
                                <input className="field-input" type="number" min="1" step="1" value={days} onChange={e => setDays(e.target.value)} />
                            </label>
                        </div>
                        <label>
                            Scope, materials, exclusions, start window
                            <textarea className="field-textarea" rows={4} value={details} onChange={e => setDetails(e.target.value)} />
                        </label>
                        <button className="btn-primary" disabled={submitting} onClick={submitQuote}>
                            {submitting ? 'Submitting…' : 'Send quote'}
                        </button>
                        {formMsg && <p className={formMsg.ok ? styles.ok : styles.error}>{formMsg.text}</p>}
                    </section>
                )}

                {!user && job.status === 'OPEN' && (
                    <section className={`glass-panel ${styles.card}`}>
                        <h2>Want this job?</h2>
                        <p className={styles.muted}>Log in with a vendor profile to submit a quote. Anyone nearby can bid — including small shops and helpers.</p>
                        <Link href={`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`} className="btn-primary">Log in to bid</Link>
                    </section>
                )}

                {myQuote && (
                    <section className={`glass-panel ${styles.card}`}>
                        <h2>Your quote</h2>
                        <p><strong>${myQuote.amount.toLocaleString()}</strong> · {myQuote.estimatedDays} day(s) · {myQuote.status}</p>
                        <p className={styles.muted}>{myQuote.details}</p>
                    </section>
                )}

                {job.status !== 'OPEN' && !isOwner && (
                    <p className={styles.muted}>This listing is {job.status.toLowerCase()} and is not accepting new quotes.</p>
                )}
            </main>
        </div>
    );
}
