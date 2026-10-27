import Link from 'next/link';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
    icon?: string;
    title: string;
    body: string;
    actionLabel?: string;
    actionHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
}

/**
 * One empty state for the whole product: says what is missing, why it is empty,
 * and gives exactly one next action (plus one optional alternative).
 */
export default function EmptyState({
    icon = '◇',
    title,
    body,
    actionLabel,
    actionHref,
    secondaryLabel,
    secondaryHref,
}: EmptyStateProps) {
    return (
        <div className={styles.wrap}>
            <span className={styles.icon} aria-hidden>
                {icon}
            </span>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
            {(actionLabel || secondaryLabel) && (
                <div className={styles.actions}>
                    {actionLabel && actionHref && (
                        <Link href={actionHref} className="btn-primary">
                            {actionLabel}
                        </Link>
                    )}
                    {secondaryLabel && secondaryHref && (
                        <Link href={secondaryHref} className="btn-secondary">
                            {secondaryLabel}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
