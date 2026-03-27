'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import type { EmailPreferences } from '@/services/emailService';
import styles from './page.module.css';

const PREF_LABELS: { key: keyof EmailPreferences; label: string; description: string }[] = [
    { key: 'quote_ready', label: 'New Quotes', description: 'When a vendor submits a quote on your project' },
    { key: 'quote_accepted', label: 'Quote Accepted', description: 'When your quote is accepted by a project owner' },
    { key: 'quote_rejected', label: 'Quote Declined', description: 'When your quote is declined by a project owner' },
    { key: 'job_match', label: 'Job Matches', description: 'When a new project matches your vendor profile' },
    { key: 'agent_approval', label: 'Agent Alerts', description: 'When your AI agent needs your input or approval' },
    { key: 'new_message', label: 'Messages', description: 'When you receive a new message on a project' },
    { key: 'verification_update', label: 'Verification Updates', description: 'When your vendor verification request is approved or declined' },
];

export default function NotificationSettings() {
    const { user, session, isLoading } = useAuth();
    const router = useRouter();
    const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); return; }
        if (!session) return;
        const load = async () => {
            const res = await fetch('/api/email-preferences', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();
            if (data.preferences) setPreferences(data.preferences);
        };
        load();
    }, [user, session, isLoading, router]);

    const togglePref = (key: keyof EmailPreferences) => {
        if (!preferences) return;
        setPreferences({ ...preferences, [key]: !preferences[key] });
        setSaved(false);
    };

    const handleSave = async () => {
        if (!session || !preferences) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/email-preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ preferences }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError('Failed to save preferences. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (isLoading || !preferences) {
        return (
            <div className={styles.container}>
                <Navbar />
                <div className={styles.content}>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: '3rem' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <Link href="/dashboard" className={styles.backLink}>{'\u2190'} Back to Dashboard</Link>

                <h1 className={styles.title}>Email Notifications</h1>
                <p className={styles.subtitle}>
                    Choose which events trigger an email notification. In-app notifications are always active.
                </p>

                <div className={styles.card}>
                    {PREF_LABELS.map(({ key, label, description }) => (
                        <div key={key} className={styles.prefRow}>
                            <div className={styles.prefInfo}>
                                <span className={styles.prefLabel}>{label}</span>
                                <span className={styles.prefDesc}>{description}</span>
                            </div>
                            <button
                                className={`${styles.toggle} ${preferences[key] ? styles.toggleOn : ''}`}
                                onClick={() => togglePref(key)}
                                type="button"
                                aria-label={`Toggle ${label}`}
                            >
                                <span className={styles.toggleThumb} />
                            </button>
                        </div>
                    ))}
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.actions}>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
                    </button>
                </div>
            </div>
        </div>
    );
}
