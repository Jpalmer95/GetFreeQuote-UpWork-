'use client';
import { useState, useEffect, useRef } from 'react';
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default function NotificationSettings() {
    const { user, session, isLoading } = useAuth();
    const router = useRouter();

    const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const [phoneNumber, setPhoneNumber] = useState('');
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [savingSms, setSavingSms] = useState(false);
    const [smsSaved, setSmsSaved] = useState(false);

    const [pushStatus, setPushStatus] = useState<'unsupported' | 'prompt' | 'granted' | 'denied'>('prompt');
    const [pushLoading, setPushLoading] = useState(false);
    const swRef = useRef<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (!isLoading && !user) { router.push('/login'); return; }
        if (!session) return;
        const load = async () => {
            try {
                const res = await fetch('/api/email-preferences', {
                    headers: { Authorization: 'Bearer ' + session.access_token },
                });
                const data = await res.json();
                if (data.preferences) setPreferences(data.preferences);
                if (data.phone_number) setPhoneNumber(data.phone_number);
                if (typeof data.sms_enabled === 'boolean') setSmsEnabled(data.sms_enabled);
            } catch {
                setError('Failed to load preferences.');
            }
        };
        load();
    }, [user, session, isLoading, router]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPushStatus('unsupported');
            return;
        }
        navigator.serviceWorker.register('/sw.js').then(reg => {
            swRef.current = reg;
        }).catch(() => {});
        if (Notification.permission === 'granted') setPushStatus('granted');
        else if (Notification.permission === 'denied') setPushStatus('denied');
        else setPushStatus('prompt');
    }, []);

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
                    Authorization: 'Bearer ' + session.access_token,
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

    const handleSaveSms = async () => {
        if (!session) return;
        setSavingSms(true);
        setError('');
        try {
            const res = await fetch('/api/sms-preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + session.access_token,
                },
                body: JSON.stringify({ phone_number: phoneNumber.trim(), sms_enabled: smsEnabled }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSmsSaved(true);
            setTimeout(() => setSmsSaved(false), 3000);
        } catch {
            setError('Failed to save SMS preferences.');
        } finally {
            setSavingSms(false);
        }
    };

    const handleEnablePush = async () => {
        if (!session || !swRef.current) return;
        setPushLoading(true);
        setError('');
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { setPushStatus('denied'); return; }
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                setError('Push notifications are not configured on this server.');
                return;
            }
            const sub = await swRef.current.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
            const res = await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
                body: JSON.stringify({ subscription: sub.toJSON() }),
            });
            if (res.ok) setPushStatus('granted');
        } catch (err) {
            console.error('Push subscribe error:', err);
            setError('Failed to enable push notifications.');
        } finally {
            setPushLoading(false);
        }
    };

    const handleDisablePush = async () => {
        if (!session) return;
        setPushLoading(true);
        try {
            await fetch('/api/push-subscribe', {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + session.access_token },
            });
            setPushStatus('prompt');
        } finally {
            setPushLoading(false);
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

                <h1 className={styles.title}>Notification Preferences</h1>
                <p className={styles.subtitle}>
                    Manage how and when BidFlow reaches you. In-app notifications are always active.
                </p>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.sectionLabel}>Email Notifications</div>
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
                                aria-label={'Toggle ' + label}
                            >
                                <span className={styles.toggleThumb} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className={styles.actions}>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Email Preferences'}
                    </button>
                </div>

                <div className={styles.sectionLabel} style={{ marginTop: '2rem' }}>SMS Notifications</div>
                <div className={styles.card}>
                    <div className={styles.prefRow}>
                        <div className={styles.prefInfo}>
                            <span className={styles.prefLabel}>Enable SMS Alerts</span>
                            <span className={styles.prefDesc}>Text alerts for high-priority events (escalations, approvals)</span>
                        </div>
                        <button
                            className={`${styles.toggle} ${smsEnabled ? styles.toggleOn : ''}`}
                            onClick={() => setSmsEnabled(v => !v)}
                            type="button"
                            aria-label="Toggle SMS"
                        >
                            <span className={styles.toggleThumb} />
                        </button>
                    </div>
                    {smsEnabled && (
                        <div className={styles.prefRow}>
                            <div className={styles.prefInfo}>
                                <span className={styles.prefLabel}>Phone Number</span>
                                <span className={styles.prefDesc}>Include country code, e.g. +1 555 123 4567</span>
                            </div>
                            <input
                                type="tel"
                                className={styles.phoneInput}
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                placeholder="+1 555 123 4567"
                            />
                        </div>
                    )}
                </div>
                <div className={styles.actions}>
                    <button className={styles.saveBtn} onClick={handleSaveSms} disabled={savingSms}>
                        {savingSms ? 'Saving...' : smsSaved ? 'Saved!' : 'Save SMS Preferences'}
                    </button>
                </div>

                <div className={styles.sectionLabel} style={{ marginTop: '2rem' }}>Push Notifications</div>
                <div className={styles.card}>
                    {pushStatus === 'unsupported' ? (
                        <div className={styles.prefRow}>
                            <div className={styles.prefInfo}>
                                <span className={styles.prefLabel}>Browser Push</span>
                                <span className={styles.prefDesc}>Your browser does not support push notifications.</span>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.prefRow}>
                            <div className={styles.prefInfo}>
                                <span className={styles.prefLabel}>Browser Push Alerts</span>
                                <span className={styles.prefDesc}>
                                    {pushStatus === 'granted'
                                        ? 'Active — you will receive instant browser alerts even when the app is in the background.'
                                        : pushStatus === 'denied'
                                        ? 'Blocked by your browser. Update browser site permissions to enable push notifications.'
                                        : 'Instant browser alerts for quotes, escalations, and approvals.'}
                                </span>
                            </div>
                            {pushStatus === 'prompt' && (
                                <button className={`${styles.saveBtn} ${styles.saveBtnInline}`} onClick={handleEnablePush} disabled={pushLoading}>
                                    {pushLoading ? 'Enabling...' : 'Enable Push'}
                                </button>
                            )}
                            {pushStatus === 'granted' && (
                                <button className={`${styles.saveBtn} ${styles.saveBtnInlineOff}`} onClick={handleDisablePush} disabled={pushLoading}>
                                    {pushLoading ? '...' : 'Disable'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className={styles.pushNote}>
                    You can also manage push notifications from{' '}
                    <Link href="/agent-hub" className={styles.managePushLink}>Agent Hub</Link>.
                </div>
            </div>
        </div>
    );
}
