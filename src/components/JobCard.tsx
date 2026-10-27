import Link from 'next/link';
import type { Job } from '@/types';
import styles from './JobCard.module.css';

const URGENCY_LABEL: Record<string, string> = {
    flexible: 'Flexible',
    within_month: 'This month',
    within_week: 'This week',
    urgent: 'Urgent',
};

const KIND_META: Record<string, { label: string; tone: string; cta: string }> = {
    quote: { label: 'Quotes', tone: 'blue', cta: 'View & bid' },
    bounty: { label: 'Bounty', tone: 'amber', cta: 'Claim it' },
    local: { label: 'Nearby', tone: 'green', cta: 'See details' },
};

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface JobCardProps {
    job: Job;
    /** Quote count, when the caller already knows it. */
    quoteCount?: number;
    /** Distance badge for the nearby surface. */
    distanceLabel?: string;
    /** Show the owner-facing status instead of the bid CTA. */
    owned?: boolean;
}

export default function JobCard({ job, quoteCount, distanceLabel, owned = false }: JobCardProps) {
    const kind = KIND_META[job.workKind || 'quote'];
    const files = job.attachments?.length || 0;
    const href = `/jobs/${job.id}`;

    return (
        <article className={styles.card}>
            <div className={styles.top}>
                <span className={`badge badge-${kind.tone}`}>{kind.label}</span>
                {job.urgency && job.urgency !== 'flexible' && (
                    <span className={`badge ${job.urgency === 'urgent' ? 'badge-amber' : 'badge-muted'}`}>
                        {URGENCY_LABEL[job.urgency]}
                    </span>
                )}
                {distanceLabel && <span className={`badge badge-green`}>{distanceLabel}</span>}
                <span className={styles.time}>{relativeTime(job.createdAt)}</span>
            </div>

            <h3 className={styles.title}>
                <Link href={href}>{job.title}</Link>
            </h3>

            <p className={styles.desc}>{job.description}</p>

            <dl className={styles.meta}>
                <div>
                    <dt>Where</dt>
                    <dd>{job.location || 'Not specified'}</dd>
                </div>
                <div>
                    <dt>Budget</dt>
                    <dd>{job.budget || 'Open to bids'}</dd>
                </div>
                <div>
                    <dt>Trade</dt>
                    <dd>{job.subcategory || job.category}</dd>
                </div>
            </dl>

            <div className={styles.footer}>
                <span className={styles.signals}>
                    {files > 0 && <span>{files} file{files === 1 ? '' : 's'}</span>}
                    {typeof quoteCount === 'number' && (
                        <span>
                            {quoteCount} quote{quoteCount === 1 ? '' : 's'}
                        </span>
                    )}
                    {owned && <span className={`badge badge-muted`}>{job.status.replace('_', ' ')}</span>}
                </span>
                <Link href={href} className={styles.cta}>
                    {owned ? 'Manage' : kind.cta} <span aria-hidden>→</span>
                </Link>
            </div>
        </article>
    );
}
