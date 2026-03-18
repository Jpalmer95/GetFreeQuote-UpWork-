'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { COMMUNITY_CATEGORIES, CommunityProjectCategory } from '@/types';
import Navbar from '@/components/Navbar';
import styles from './page.module.css';

export default function NewCommunityProject() {
    const router = useRouter();
    const { user, session } = useAuth();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<CommunityProjectCategory>('Other');
    const [location, setLocation] = useState('');
    const [goalAmount, setGoalAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !goalAmount) {
            setError('Title and funding goal are required');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const token = session?.access_token;
            const res = await fetch('/api/community', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    action: 'create-project',
                    title,
                    description,
                    category,
                    location,
                    goalAmount: parseFloat(goalAmount),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(`/community/${data.project.id}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create project';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <p style={{ textAlign: 'center', marginTop: '3rem', color: 'rgba(255,255,255,0.5)' }}>
                        Please <Link href="/login" style={{ color: 'var(--primary-light)' }}>sign in</Link> to create a community project.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <Link href="/community" className={styles.backLink}>
                    {'\u2190'} Back to Community
                </Link>

                <h1 className={styles.title}>Start a Community Project</h1>
                <p className={styles.subtitle}>
                    Create a transparent, publicly-funded initiative with smart contract-backed escrow.
                </p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Project Title *</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="e.g., Riverside Park Community Garden"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Description</label>
                        <textarea
                            className={styles.textarea}
                            placeholder="Describe your project, its goals, and how funds will be used..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Category</label>
                            <select
                                className={styles.select}
                                value={category}
                                onChange={e => setCategory(e.target.value as CommunityProjectCategory)}
                            >
                                {COMMUNITY_CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Funding Goal ($) *</label>
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="10000"
                                value={goalAmount}
                                onChange={e => setGoalAmount(e.target.value)}
                                min="1"
                                step="1"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Location</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="e.g., Portland, OR"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <button
                        type="submit"
                        className={styles.btnSubmit}
                        disabled={submitting || !title || !goalAmount}
                    >
                        {submitting ? 'Creating...' : 'Create Community Project'}
                    </button>
                </form>
            </div>
        </div>
    );
}
