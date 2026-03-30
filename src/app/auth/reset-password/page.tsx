'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/app/login/page.module.css';

function ResetPasswordForm() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setReady(true);
            } else {
                router.replace('/login?error=' + encodeURIComponent('Invalid or expired reset link. Please request a new one.'));
            }
        });
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            setSuccess(true);
            setTimeout(() => router.push('/dashboard'), 2500);
        } catch (err: unknown) {
            let message = 'An unexpected error occurred.';
            if (err instanceof Error) message = err.message;
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (!ready) {
        return (
            <div className={styles.page}>
                <div className={styles.orb1} />
                <div className={styles.orb2} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className={styles.spinner} />
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Verifying reset link…</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className={styles.page}>
                <div className={styles.orb1} />
                <div className={styles.orb2} />

                <div className={`glass-panel ${styles.card}`}>
                    <div className={styles.cardHeader}>
                        <Link href="/" className={styles.backLink}>← Back</Link>
                        <div className={styles.logoMark}>B</div>
                    </div>

                    <div className={styles.successBox}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40" className={styles.successIcon}>
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                            <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <h2 className={styles.title}>Password updated</h2>
                        <p className={styles.successText}>
                            Your password has been changed successfully. Redirecting you to the dashboard…
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />

            <div className={`glass-panel ${styles.card}`}>
                <div className={styles.cardHeader}>
                    <Link href="/login" className={styles.backLink}>← Back to Log In</Link>
                    <div className={styles.logoMark}>B</div>
                </div>

                <h2 className={styles.title}>Set new password</h2>
                <p className={styles.subtitle}>Choose a strong password for your account.</p>

                {error && (
                    <div className={styles.errorBox}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>New Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="field-input"
                            minLength={8}
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Confirm Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="field-input"
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn-primary ${styles.submitBtn}`}
                    >
                        {loading ? (
                            <>
                                <span className={styles.spinner} />
                                Updating…
                            </>
                        ) : (
                            'Update Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordForm />
        </Suspense>
    );
}
