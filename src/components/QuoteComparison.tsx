'use client';
import { useState, useMemo } from 'react';
import { Quote } from '@/types';
import styles from './QuoteComparison.module.css';

type SortMode = 'price_asc' | 'price_desc' | 'timeline_asc' | 'score';

interface VendorInfo {
    rating?: number;
    isVerified?: boolean;
}

interface QuoteComparisonProps {
    quotes: Quote[];
    vendorInfo?: Record<string, VendorInfo>;
    onAccept?: (quoteId: string) => void;
    onReject?: (quoteId: string) => void;
    onClose: () => void;
}

function computeBestValueIndex(quotes: Quote[], vendorInfo?: Record<string, VendorInfo>): number {
    if (quotes.length === 0) return -1;

    const prices = quotes.map(q => q.amount);
    const timelines = quotes.map(q => q.estimatedDays);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const maxTimeline = Math.max(...timelines);
    const minTimeline = Math.min(...timelines);

    const priceRange = maxPrice - minPrice || 1;
    const timelineRange = maxTimeline - minTimeline || 1;

    let bestIdx = 0;
    let bestScore = -Infinity;

    quotes.forEach((q, i) => {
        const priceScore = 1 - (q.amount - minPrice) / priceRange;
        const timelineScore = 1 - (q.estimatedDays - minTimeline) / timelineRange;
        const info = vendorInfo?.[q.vendorId];
        const ratingScore = info?.rating ? (info.rating / 5) : 0.5;
        const verifiedBonus = info?.isVerified ? 0.1 : 0;

        const score = (priceScore * 0.45) + (timelineScore * 0.3) + (ratingScore * 0.2) + verifiedBonus;

        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    });

    return bestIdx;
}

function renderStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export default function QuoteComparison({ quotes, vendorInfo, onAccept, onReject, onClose }: QuoteComparisonProps) {
    const [sortMode, setSortMode] = useState<SortMode>('score');

    const computeScore = (q: Quote): number => {
        const prices = quotes.map(x => x.amount);
        const timelines = quotes.map(x => x.estimatedDays);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const maxTimeline = Math.max(...timelines);
        const minTimeline = Math.min(...timelines);
        const priceRange = maxPrice - minPrice || 1;
        const timelineRange = maxTimeline - minTimeline || 1;

        const priceScore = 1 - (q.amount - minPrice) / priceRange;
        const timelineScore = 1 - (q.estimatedDays - minTimeline) / timelineRange;
        const info = vendorInfo?.[q.vendorId];
        const ratingScore = info?.rating ? (info.rating / 5) : 0.5;
        const verifiedBonus = info?.isVerified ? 0.1 : 0;

        return (priceScore * 0.45) + (timelineScore * 0.3) + (ratingScore * 0.2) + verifiedBonus;
    };

    const sortedQuotes = useMemo(() => {
        const sorted = [...quotes];
        switch (sortMode) {
            case 'price_asc':
                sorted.sort((a, b) => a.amount - b.amount);
                break;
            case 'price_desc':
                sorted.sort((a, b) => b.amount - a.amount);
                break;
            case 'timeline_asc':
                sorted.sort((a, b) => a.estimatedDays - b.estimatedDays);
                break;
            case 'score':
                sorted.sort((a, b) => computeScore(b) - computeScore(a));
                break;
        }
        return sorted;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quotes, sortMode, vendorInfo]);

    const bestValueIdx = useMemo(() => computeBestValueIndex(sortedQuotes, vendorInfo), [sortedQuotes, vendorInfo]);

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalTitle}>Compare Quotes ({quotes.length})</span>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.toolbar}>
                    <span className={styles.sortLabel}>Sort by</span>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'score' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('score')}
                    >
                        Best Value
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'price_asc' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('price_asc')}
                    >
                        Price: Low → High
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'price_desc' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('price_desc')}
                    >
                        Price: High → Low
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'timeline_asc' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('timeline_asc')}
                    >
                        Fastest First
                    </button>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.compTable}>
                        <thead>
                            <tr>
                                <th className={styles.rowLabel}></th>
                                {sortedQuotes.map((q, i) => (
                                    <th key={q.id} className={styles.vendorHeader}>
                                        {i === bestValueIdx && (
                                            <span className={styles.bestValueBadge}>★ Best Value</span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={styles.rowLabel}>Vendor</td>
                                {sortedQuotes.map((q, i) => (
                                    <td key={q.id} className={`${styles.vendorNameCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                        {q.vendorName}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Price</td>
                                {sortedQuotes.map((q, i) => (
                                    <td key={q.id} className={`${styles.priceCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                        ${q.amount.toLocaleString()}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Timeline</td>
                                {sortedQuotes.map((q, i) => (
                                    <td key={q.id} className={`${styles.timelineCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                        {q.estimatedDays} day{q.estimatedDays !== 1 ? 's' : ''}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Verified</td>
                                {sortedQuotes.map((q, i) => {
                                    const info = vendorInfo?.[q.vendorId];
                                    return (
                                        <td key={q.id} className={`${styles.statusCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                            {info?.isVerified ? (
                                                <span className={styles.verifiedBadge}>✓ Verified</span>
                                            ) : (
                                                <span className={styles.noRating}>Not verified</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Rating</td>
                                {sortedQuotes.map((q, i) => {
                                    const info = vendorInfo?.[q.vendorId];
                                    return (
                                        <td key={q.id} className={`${styles.ratingCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                            {info?.rating ? (
                                                <span className={styles.stars}>{renderStars(info.rating)} {info.rating.toFixed(1)}</span>
                                            ) : (
                                                <span className={styles.noRating}>No rating</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Details</td>
                                {sortedQuotes.map((q, i) => (
                                    <td key={q.id} className={`${styles.detailsCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                        {q.details || '—'}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className={styles.rowLabel}>Status</td>
                                {sortedQuotes.map((q, i) => (
                                    <td key={q.id} className={`${styles.statusCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                        <span className={`badge ${q.status === 'ACCEPTED' ? 'badge-green' : q.status === 'REJECTED' ? 'badge-muted' : 'badge-blue'}`}>
                                            {q.status}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                            {(onAccept || onReject) && sortedQuotes.some(q => q.status === 'PENDING') && (
                                <tr>
                                    <td className={styles.rowLabel}>Actions</td>
                                    {sortedQuotes.map((q, i) => (
                                        <td key={q.id} className={`${styles.actionsCell} ${i === bestValueIdx ? styles.bestCol : ''}`}>
                                            {q.status === 'PENDING' ? (
                                                <div className={styles.actionBtns}>
                                                    {onAccept && (
                                                        <button className={styles.acceptBtn} onClick={() => onAccept(q.id)}>Accept</button>
                                                    )}
                                                    {onReject && (
                                                        <button className={styles.rejectBtn} onClick={() => onReject(q.id)}>Reject</button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span>—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function CompareQuotesButton({ quotes, onClick }: { quotes: Quote[]; onClick: () => void }) {
    if (quotes.length < 2) return null;
    return (
        <button className={styles.compareBtn} onClick={onClick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
            </svg>
            Compare Quotes ({quotes.length})
        </button>
    );
}
