'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { CommunityProject, CommunityProjectCategory, COMMUNITY_CATEGORIES } from '@/types';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

const CATEGORY_ICONS: Record<string, string> = {
    'Parks & Recreation': '\u{1F333}',
    'Infrastructure': '\u{1F3D7}',
    'Education': '\u{1F4DA}',
    'Arts & Culture': '\u{1F3A8}',
    'Environment': '\u{1F30D}',
    'Public Safety': '\u{1F6E1}',
    'Community Spaces': '\u{1F3E0}',
    'Open Source': '\u{1F4BB}',
    'Other': '\u{2728}',
};

function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function getBadgeClass(status: string): string {
    if (status === 'FUNDED' || status === 'IN_PROGRESS') return styles.badgeFunded;
    if (status === 'COMPLETED' || status === 'CANCELLED') return styles.badgeCompleted;
    return styles.badgeActive;
}

export default function CommunityPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<CommunityProject[]>([]);
    const [category, setCategory] = useState<CommunityProjectCategory | ''>('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(async () => {
            const results = await db.getCommunityProjects({
                category: category || undefined,
                query: search || undefined,
            });
            setProjects(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [category, search]);

    return (
        <div className={styles.container}>
            <Navbar />

            <div className={styles.hero}>
                <h1 className={styles.heroTitle}>
                    <span className="gradient-text">Community Projects</span>
                </h1>
                <p className={styles.heroSub}>
                    Fund public improvements, open-source tools, and community initiatives with
                    transparent smart contract-backed escrow.
                </p>
                <div className={styles.heroActions}>
                    {user && (
                        <Link href="/community/new" className={styles.btnPrimary}>
                            Start a Project
                        </Link>
                    )}
                </div>
            </div>

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Search</span>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className={styles.searchInput}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterSection}>
                        <span className={styles.filterLabel}>Category</span>
                        <div className={styles.pillGroup}>
                            <button
                                className={`${styles.pill} ${category === '' ? styles.pillActive : ''}`}
                                onClick={() => setCategory('')}
                            >
                                All Categories
                            </button>
                            {COMMUNITY_CATEGORIES.map(c => (
                                <button
                                    key={c}
                                    className={`${styles.pill} ${category === c ? styles.pillActive : ''}`}
                                    onClick={() => setCategory(c)}
                                >
                                    {CATEGORY_ICONS[c] || ''} {c}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className={styles.main}>
                    {projects.length === 0 ? (
                        <div className={styles.empty}>
                            <div className={styles.emptyIcon}>{'\u{1F30E}'}</div>
                            <div className={styles.emptyTitle}>No community projects yet</div>
                            <p>Be the first to start a community initiative!</p>
                        </div>
                    ) : (
                        <div className={styles.grid}>
                            {projects.map(p => {
                                const pct = p.goalAmount > 0 ? Math.min(100, (p.currentFunding / p.goalAmount) * 100) : 0;
                                return (
                                    <Link href={`/community/${p.id}`} key={p.id} className={styles.card}>
                                        <div className={styles.cardImage}>
                                            {CATEGORY_ICONS[p.category] || '\u{2728}'}
                                            <span className={`${styles.cardBadge} ${getBadgeClass(p.status)}`}>
                                                {p.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className={styles.cardBody}>
                                            <div className={styles.cardCategory}>{p.category}</div>
                                            <div className={styles.cardTitle}>{p.title}</div>
                                            <div className={styles.cardDesc}>{p.description}</div>
                                            {p.location && (
                                                <div className={styles.cardLocation}>{'\u{1F4CD}'} {p.location}</div>
                                            )}
                                            <div className={styles.progressBar}>
                                                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className={styles.cardStats}>
                                                <span className={styles.cardFunded}>{formatCurrency(p.currentFunding)}</span>
                                                <span className={styles.cardGoal}>of {formatCurrency(p.goalAmount)}</span>
                                                <span className={styles.cardPercent}>{Math.round(pct)}%</span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
