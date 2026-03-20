'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

    const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('USER');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName, role } }
                });
                if (signUpError) throw signUpError;
                router.push('/dashboard');
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) throw signInError;
                router.push('/dashboard');
            }
        } catch (err: unknown) {
            let message = 'An unexpected error occurred.';
            if (err instanceof Error) {
                if (err.message === 'Load failed' || err.message === 'Failed to fetch' || err.message === 'NetworkError when attempting to fetch resource.') {
                    message = 'Unable to connect to the server. Please check your internet connection and try again.';
                } else {
                    message = err.message;
                }
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />

            <div className={`glass-panel ${styles.card}`}>
                <div className={styles.cardHeader}>
                    <Link href="/" className={styles.backLink}>← Back</Link>
                    <div className={styles.logoMark}>B</div>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
                        onClick={() => setMode('login')}
                        type="button"
                    >
                        Log In
                    </button>
                    <button
                        className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
                        onClick={() => setMode('signup')}
                        type="button"
                    >
                        Sign Up
                    </button>
                </div>

                <h2 className={styles.title}>
                    {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className={styles.subtitle}>
                    {mode === 'login'
                        ? 'Sign in to manage your projects and quotes.'
                        : 'Join BidFlow and simplify getting estimates.'}
                </p>

                {error && (
                    <div className={styles.errorBox}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleAuth} className={styles.form}>
                    {mode === 'signup' && (
                        <>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Jane Smith"
                                    className="field-input"
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>I am a…</label>
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value)}
                                    className="field-select"
                                >
                                    <option value="USER">Client / Project Owner</option>
                                    <option value="VENDOR">Service Provider / Vendor</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="field-input"
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="field-input"
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
                                Processing…
                            </>
                        ) : (
                            mode === 'login' ? 'Log In' : 'Create Account'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
