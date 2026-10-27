'use client';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import MediaGallery from '@/components/MediaGallery';
import EmptyState from '@/components/EmptyState';
import FileUpload from '@/components/FileUpload';
import { useAuth } from '@/context/AuthContext';
import { Job, Quote } from '@/types';
import { db } from '@/services/db';
import { listJobUpdates, addJobUpdate, JobUpdate, JobUpdateKind, UPDATE_KIND_LABEL } from '@/services/jobUpdates';
import styles from './page.module.css';

const URGENCY: Record<string, string> = {
    flexible: 'Flexible timing',
    within_month: 'Within a month',
    within_week: 'Within a week',
    urgent: 'Urgent / ASAP',
};

const STATUS_LABEL: Record<string, string> = {
    OPEN: 'Open for quotes',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    DRAFT: 'Draft',
};

const KIND_CHOICES: { value: JobUpdateKind; label: string }[] = [
    { value: 'clarification', label: 'Clarification' },
    { value: 'scope_change', label: 'Scope change' },
    { value: 'schedule', label: 'Schedule' },
    { value: 'media', label: 'Photo / video note' },
];

function money(n: number): string {
    return `$${Math.round(n).toLocaleString()}`;
}

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [job, setJob] = useState<Job | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [updates, setUpdates] = useState<JobUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const [amount, setAmount] = useState('');
    const [days, setDays] = useState('1');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [bidMsg, setBidMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const [updateBody, setUpdateBody] = useState('');
    const [updateKind, setUpdateKind] = useState<JobUpdateKind>('clarification');
    const [updateFiles, setUpdateFiles] = useState<string[]>([]);
    const [postingUpdate, setPostingUpdate] = useState(false);
    const [updateMsg, setUpdateMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const [awarding, setAwarding] = useState<string | null>(null);
    const [awardMsg, setAwardMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const j = await db.getJob(id);
            if (!j) {
                setJob(null);
                return;
            }
            setJob(j);
            setUpdates(await listJobUpdates(id));
            if (user && session) {
                const res = await fetch(`/api/quotes?jobId=${encodeURIComponent(id)}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    const json = (await res.json()) as { data?: Record<string, unknown>[] };
                    setQuotes(
                        (json.data || []).map(r => ({
                            id: String(r.id),
                            jobId: r.job_id ? String(r.job_id) : undefined,
                            vendorId: String(r.vendor_id),
                            vendorName: String(r.vendor_name || 'Contractor'),
                            amount: Number(r.amount) || 0,
                            estimatedDays: Number(r.estimated_days) || 0,
                            details: String(r.details || ''),
                            status: String(r.status || 'PENDING') as Quote['status'],
                            createdAt: String(r.created_at),
                        })),
                    );
                }
            }
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Could not load this job.');
        } finally {
            setLoading(false);
        }
    }, [id, user, session]);

    useEffect(() => {
        void load();
    }, [load]);

    const isOwner = !!(user && job && user.id === job.userId);
    const myQuote = useMemo(
        () => (user ? quotes.find(q => q.vendorId === user.id) || null : null),
        [quotes, user],
    );
    const ranked = useMemo(() => [...quotes].sort((a, b) => a.amount - b.amount), [quotes]);
    const fastest = useMemo(
        () => (quotes.length ? Math.min(...quotes.map(q => q.estimatedDays)) : null),
        [quotes],
    );
    const canBid = !!(user && job && job.status === 'OPEN' && !isOwner && !myQuote);

    const submitQuote = async () => {
        if (!session) {
            router.push(`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`);
            return;
        }
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
            setBidMsg({ ok: false, text: 'Enter a price above zero.' });
            return;
        }
        if (details.trim().length < 15) {
            setBidMsg({
                ok: false,
                text: 'Describe what is included so the owner can compare fairly (at least 15 characters).',
            });
            return;
        }
        setSubmitting(true);
        setBidMsg(null);
        try {
            const res = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    jobId: id,
                    amount: n,
                    estimatedDays: Math.max(1, Number(days) || 1),
                    details: details.trim(),
                }),
            });
            let json: { error?: string } = {};
            try {
                json = await res.json();
            } catch {
                /* empty body */
            }
            if (!res.ok) {
                setBidMsg({ ok: false, text: json.error || `Could not send the quote (HTTP ${res.status}).` });
            } else {
                setBidMsg({ ok: true, text: 'Quote sent. The owner sees it now, and you get notified if the brief changes.' });
                setAmount('');
                setDetails('');
                await load();
            }
        } catch (err) {
            setBidMsg({ ok: false, text: err instanceof Error ? err.message : 'Network error — try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const postUpdate = async () => {
        if (!session) return;
        const body = updateBody.trim();
        if (body.length < 4) {
            setUpdateMsg({ ok: false, text: 'Write at least a few words.' });
            return;
        }
        setPostingUpdate(true);
        setUpdateMsg(null);
        const result = await addJobUpdate(id, session.access_token, {
            body,
            kind: updateKind,
            attachments: updateFiles,
        });
        if (result.ok) {
            setUpdates(prev => [...prev, result.update]);
            setUpdateBody('');
            setUpdateFiles([]);
            setUpdateMsg({
                ok: true,
                text: 'Posted. It is on the brief for every bidder, and everyone who already quoted was notified.',
            });
        } else {
            setUpdateMsg({ ok: false, text: result.error });
        }
        setPostingUpdate(false);
    };

    const acceptQuote = async (quoteId: string, vendorName: string, price: number) => {
        if (!session) return;
        const sure = window.confirm(
            `Award this job to ${vendorName} for ${money(price)}?\n\n` +
                'This rejects the other quotes, creates the work order, and opens the milestone record. ' +
                'Payment still happens directly between you and the contractor.',
        );
        if (!sure) return;
        setAwarding(quoteId);
        setAwardMsg(null);
        try {
            const res = await fetch('/api/quote-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ quoteId, action: 'accept' }),
            });
            let json: { error?: string } = {};
            try {
                json = await res.json();
            } catch {
                /* empty body */
            }
            if (!res.ok) {
                setAwardMsg({ ok: false, text: json.error || `Could not award the job (HTTP ${res.status}).` });
            } else {
                setAwardMsg({
                    ok: true,
                    text: 'Awarded. The contractor has the work order, the other bidders were notified, and a milestone record is open for both of you.',
                });
                await load();
            }
        } catch (err) {
            setAwardMsg({ ok: false, text: err instanceof Error ? err.message : 'Network error — try again.' });
        } finally {
            setAwarding(null);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        } catch {
            setCopied(false);
        }
    };

    if (isLoading || loading) return <div className="loading-screen">Loading brief…</div>;

    if (loadError) {
        return (
            <div>
                <Navbar />
                <main className="gfq-page">
                    <div className="gfq-alert gfq-alert-error" role="alert">
                        {loadError}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-primary" onClick={() => void load()}>
                            Try again
                        </button>
                        <Link href="/marketplace" className="btn-secondary">
                            Browse jobs
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    if (!job) {
        return (
            <div>
                <Navbar />
                <main className="gfq-page">
                    <EmptyState
                        icon="🔍"
                        title="This job is not available"
                        body="It may have been taken down, cancelled, or made private by the owner."
                        actionLabel="Browse open jobs"
                        actionHref="/marketplace"
                    />
                </main>
            </div>
        );
    }

    const kindLabel = job.workKind === 'bounty' ? 'Fixed bounty' : job.isLocalRequest ? 'Nearby / same-day' : 'Quotes';
    const files = job.attachments || [];

    return (
        <div>
            <Navbar />
            <main className="gfq-page">
                <nav className={styles.crumbs} aria-label="Breadcrumb">
                    <Link href="/marketplace">Browse</Link>
                    <span aria-hidden>›</span>
                    <span>{job.subcategory || job.category || 'Job'}</span>
                </nav>

                <div className={styles.layout}>
                    <div className={styles.main}>
                        <header className={styles.header}>
                            <div className={styles.chips}>
                                <span className={`badge ${job.workKind === 'bounty' ? 'badge-amber' : 'badge-blue'}`}>
                                    {kindLabel}
                                </span>
                                <span className="badge badge-muted">{job.industryVertical}</span>
                                {job.subcategory && job.subcategory !== job.industryVertical && (
                                    <span className="badge badge-muted">{job.subcategory}</span>
                                )}
                                <span className={`badge ${job.status === 'OPEN' ? 'badge-green' : 'badge-muted'}`}>
                                    {STATUS_LABEL[job.status] || job.status}
                                </span>
                            </div>

                            <h1 className={styles.title}>{job.title}</h1>

                            <p className={styles.metaRow}>
                                <span>{job.location || 'Location not specified'}</span>
                                <span aria-hidden>·</span>
                                <span>Posted {timeAgo(job.createdAt)}</span>
                                {isOwner && (
                                    <>
                                        <span aria-hidden>·</span>
                                        <span className={styles.ownerTag}>You posted this</span>
                                    </>
                                )}
                            </p>

                            <div className={styles.factRow}>
                                <div className={styles.fact}>
                                    <span className={styles.factLabel}>Budget</span>
                                    <span className={styles.factValue}>{job.budget || 'Open to bids'}</span>
                                </div>
                                <div className={styles.fact}>
                                    <span className={styles.factLabel}>Timing</span>
                                    <span className={styles.factValue}>{URGENCY[job.urgency || 'flexible'] || 'Flexible'}</span>
                                </div>
                                <div className={styles.fact}>
                                    <span className={styles.factLabel}>
                                        {job.workKind === 'bounty' ? 'Claim price' : 'Quotes in'}
                                    </span>
                                    <span className={styles.factValue}>
                                        {isOwner ? String(quotes.length) : job.workKind === 'bounty' ? 'Fixed' : 'Open'}
                                    </span>
                                </div>
                            </div>
                        </header>

                        <MediaGallery urls={files} />

                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>The brief</h2>
                            <p className={styles.description}>{job.description}</p>

                            <dl className={styles.specs}>
                                {job.squareFootage && (
                                    <div>
                                        <dt>Size</dt>
                                        <dd>{job.squareFootage}</dd>
                                    </div>
                                )}
                                {job.materials && (
                                    <div>
                                        <dt>Materials</dt>
                                        <dd>{job.materials}</dd>
                                    </div>
                                )}
                                {(job.timelineStart || job.timelineEnd) && (
                                    <div>
                                        <dt>Window</dt>
                                        <dd>
                                            {job.timelineStart || 'TBD'} → {job.timelineEnd || 'TBD'}
                                        </dd>
                                    </div>
                                )}
                                <div>
                                    <dt>Permit</dt>
                                    <dd>{job.requiresPermit ? 'Required' : 'Not needed'}</dd>
                                </div>
                                {job.radiusMiles ? (
                                    <div>
                                        <dt>Radius</dt>
                                        <dd>{job.radiusMiles} mi</dd>
                                    </div>
                                ) : null}
                                {job.tags.length > 0 && (
                                    <div className={styles.specWide}>
                                        <dt>Tags</dt>
                                        <dd className={styles.tags}>
                                            {job.tags.map(t => (
                                                <span key={t} className={styles.tag}>
                                                    {t}
                                                </span>
                                            ))}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </section>

                        <section className={styles.card} aria-labelledby="updates-heading">
                            <div className={styles.cardHead}>
                                <h2 id="updates-heading" className={styles.cardTitle}>
                                    Live updates
                                </h2>
                                <span className={styles.cardHint}>
                                    {updates.length === 0
                                        ? 'No changes yet'
                                        : `${updates.length} update${updates.length === 1 ? '' : 's'}`}
                                </span>
                            </div>
                            <p className={styles.cardSub}>
                                Details that change get posted here instead of a text thread. Everyone who quoted sees
                                the update, and every quote stays priced against the latest brief.
                            </p>

                            {updates.length === 0 ? (
                                <p className={styles.muted}>Nothing has changed since this job was posted.</p>
                            ) : (
                                <ol className={styles.feed}>
                                    {updates.map(u => (
                                        <li key={u.id} className={styles.feedItem}>
                                            <div className={styles.feedTop}>
                                                <span className="badge badge-muted">
                                                    {UPDATE_KIND_LABEL[u.kind] || 'Update'}
                                                </span>
                                                <span className={styles.feedTime}>{timeAgo(u.createdAt)}</span>
                                            </div>
                                            <p className={styles.feedBody}>{u.body}</p>
                                            {u.attachments.length > 0 && (
                                                <div className={styles.feedFiles}>
                                                    {u.attachments.map(url => (
                                                        <a
                                                            key={url}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={styles.feedFile}
                                                        >
                                                            {url.split('/').pop()}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <span className={styles.feedAuthor}>{u.authorName || 'Job owner'}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            {isOwner && (
                                <div className={styles.composer}>
                                    <label className={styles.fieldLabel} htmlFor="update-kind">
                                        Kind
                                    </label>
                                    <select
                                        id="update-kind"
                                        className="field-select"
                                        value={updateKind}
                                        onChange={e => setUpdateKind(e.target.value as JobUpdateKind)}
                                    >
                                        {KIND_CHOICES.map(k => (
                                            <option key={k.value} value={k.value}>
                                                {k.label}
                                            </option>
                                        ))}
                                    </select>

                                    <label className={styles.fieldLabel} htmlFor="update-body">
                                        Clarify or change something
                                    </label>
                                    <textarea
                                        id="update-body"
                                        className="field-textarea"
                                        rows={3}
                                        placeholder="e.g. The north gate is 12 ft, not 10 — posts are 6 ft on center."
                                        value={updateBody}
                                        onChange={e => setUpdateBody(e.target.value)}
                                    />

                                    {session && (
                                        <FileUpload
                                            bucket="job-attachments"
                                            userId={user.id}
                                            maxFiles={5}
                                            label="Attach a photo, video or document"
                                            hint="Video (MP4/WebM), images or PDF up to 25MB"
                                            acceptVideo
                                            onUpload={urls => setUpdateFiles(prev => [...prev, ...urls])}
                                            onRemove={url => setUpdateFiles(prev => prev.filter(u => u !== url))}
                                        />
                                    )}

                                    <div className={styles.composerActions}>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => void postUpdate()}
                                            disabled={postingUpdate}
                                        >
                                            {postingUpdate ? 'Posting…' : 'Post to the brief'}
                                        </button>
                                        {updateMsg && (
                                            <p className={updateMsg.ok ? styles.ok : styles.error} role="status">
                                                {updateMsg.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <aside className={styles.side} aria-label="Quotes and actions">
                        {isOwner ? (
                            <section className={styles.card}>
                                <div className={styles.cardHead}>
                                    <h2 className={styles.cardTitle}>Quotes</h2>
                                    <span className={styles.cardHint}>
                                        {quotes.length === 0 ? 'none yet' : `${quotes.length} in`}
                                    </span>
                                </div>

                                {awardMsg && (
                                    <p className={awardMsg.ok ? styles.ok : styles.error} role="status">
                                        {awardMsg.text}
                                    </p>
                                )}

                                {quotes.length === 0 ? (
                                    <p className={styles.muted}>
                                        Your job is live. Quotes land here as contractors and their agents respond —
                                        usually within the same day.
                                    </p>
                                ) : (
                                    <ul className={styles.quotes}>
                                        {ranked.map((q, i) => (
                                            <li key={q.id} className={styles.quote}>
                                                <div className={styles.quoteTop}>
                                                    <strong>{money(q.amount)}</strong>
                                                    <span className={styles.quoteDays}>{q.estimatedDays} day(s)</span>
                                                </div>
                                                <p className={styles.quoteVendor}>{q.vendorName}</p>
                                                <div className={styles.quoteFlags}>
                                                    {i === 0 && <span className="badge badge-green">Lowest</span>}
                                                    {fastest === q.estimatedDays && (
                                                        <span className="badge badge-blue">Fastest</span>
                                                    )}
                                                    {q.status !== 'PENDING' && (
                                                        <span
                                                            className={`badge ${
                                                                q.status === 'ACCEPTED' ? 'badge-green' : 'badge-muted'
                                                            }`}
                                                        >
                                                            {q.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={styles.quoteDetails}>{q.details}</p>
                                                {q.status === 'PENDING' && job.status === 'OPEN' && (
                                                    <button
                                                        type="button"
                                                        className="btn-primary"
                                                        onClick={() => void acceptQuote(q.id, q.vendorName, q.amount)}
                                                        disabled={awarding === q.id}
                                                    >
                                                        {awarding === q.id ? 'Awarding…' : 'Award this job'}
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p className={styles.smallPrint}>
                                    Awarding creates the work order and the milestone record. Payment happens directly
                                    between you and the contractor — GetFreeQuote never holds funds.
                                </p>
                            </section>
                        ) : (
                            <section className={styles.card}>
                                <div className={styles.cardHead}>
                                    <h2 className={styles.cardTitle}>
                                        {myQuote ? 'Your quote' : job.workKind === 'bounty' ? 'Claim this job' : 'Send a quote'}
                                    </h2>
                                </div>

                                {myQuote ? (
                                    <>
                                        <p className={styles.quoteBig}>{money(myQuote.amount)}</p>
                                        <p className={styles.muted}>
                                            {myQuote.estimatedDays} day(s) ·{' '}
                                            <span
                                                className={`badge ${
                                                    myQuote.status === 'ACCEPTED' ? 'badge-green' : 'badge-muted'
                                                }`}
                                            >
                                                {myQuote.status}
                                            </span>
                                        </p>
                                        <p className={styles.quoteDetails}>{myQuote.details}</p>
                                        <p className={styles.smallPrint}>
                                            You will be notified here if the owner changes the brief.
                                        </p>
                                    </>
                                ) : !user ? (
                                    <>
                                        <p className={styles.muted}>
                                            Anyone can bid — an individual, a small shop, or a company agent with an API
                                            key. Sign in once and this page keeps your quote.
                                        </p>
                                        <Link
                                            href={`/login?redirect=${encodeURIComponent(`/jobs/${id}`)}`}
                                            className="btn-primary"
                                        >
                                            Sign in to bid
                                        </Link>
                                        <p className={styles.smallPrint}>
                                            Using an agent? Point it at the job from <Link href="/connect">/connect</Link>.
                                        </p>
                                    </>
                                ) : job.status !== 'OPEN' ? (
                                    <p className={styles.muted}>
                                        This job is {(STATUS_LABEL[job.status] || job.status).toLowerCase()} and is not
                                        taking new quotes.
                                    </p>
                                ) : (
                                    <>
                                        <label className={styles.fieldLabel} htmlFor="bid-amount">
                                            Your price (USD)
                                        </label>
                                        <input
                                            id="bid-amount"
                                            className="field-input"
                                            type="number"
                                            min="1"
                                            step="1"
                                            inputMode="decimal"
                                            placeholder="e.g. 8200"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                        />

                                        <label className={styles.fieldLabel} htmlFor="bid-days">
                                            Working days
                                        </label>
                                        <input
                                            id="bid-days"
                                            className="field-input"
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={days}
                                            onChange={e => setDays(e.target.value)}
                                        />

                                        <label className={styles.fieldLabel} htmlFor="bid-details">
                                            What is included
                                        </label>
                                        <textarea
                                            id="bid-details"
                                            className="field-textarea"
                                            rows={4}
                                            placeholder="Materials, scope, exclusions, start date. Anything you exclude now becomes a change order later."
                                            value={details}
                                            onChange={e => setDetails(e.target.value)}
                                        />

                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => void submitQuote()}
                                            disabled={submitting || !canBid}
                                        >
                                            {submitting
                                                ? 'Sending…'
                                                : job.workKind === 'bounty'
                                                  ? 'Claim at this price'
                                                  : 'Send quote'}
                                        </button>
                                        {bidMsg && (
                                            <p className={bidMsg.ok ? styles.ok : styles.error} role="status">
                                                {bidMsg.text}
                                            </p>
                                        )}
                                        <p className={styles.smallPrint}>
                                            One quote per person. The owner compares every bid side by side.
                                        </p>
                                    </>
                                )}
                            </section>
                        )}

                        <section className={styles.card}>
                            <h2 className={styles.cardTitle}>Share</h2>
                            <p className={styles.muted}>
                                Send this brief to a contractor you trust, or hand it to your own agent.
                            </p>
                            <div className={styles.shareRow}>
                                <button type="button" className="btn-secondary" onClick={() => void copyLink()}>
                                    {copied ? 'Link copied ✓' : 'Copy link'}
                                </button>
                                <Link href="/how-to" className="btn-secondary">
                                    How bidding works
                                </Link>
                            </div>
                        </section>
                    </aside>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
