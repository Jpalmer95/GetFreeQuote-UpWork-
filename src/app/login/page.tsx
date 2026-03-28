'use client';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { getAuthCallbackUrl } from '@/lib/auth-helpers';
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
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signupSuccess, setSignupSuccess] = useState(false);

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    useEffect(() => {
        const urlError = searchParams.get('error');
        if (urlError) setError(urlError);
    }, [searchParams]);

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setError(null);
        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: getAuthCallbackUrl(),
                },
            });
            if (oauthError) throw oauthError;
        } catch (err: unknown) {
            let message = 'An unexpected error occurred.';
            if (err instanceof Error) message = err.message;
            setError(message);
            setGoogleLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName, role },
                        emailRedirectTo: getAuthCallbackUrl(),
                    }
                });
                if (signUpError) throw signUpError;
                const needsConfirmation = data.user && !data.session;
                if (needsConfirmation) {
                    setSignupSuccess(true);
                } else {
                    router.push('/dashboard');
                }
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

    if (signupSuccess) {
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
                        <h2 className={styles.title}>Check your email</h2>
                        <p className={styles.successText}>
                            We sent a confirmation link to <strong>{email}</strong>.
                            Click the link in the email to activate your account, then come back to log in.
                        </p>
                        <button
                            type="button"
                            className={`btn-secondary ${styles.submitBtn}`}
                            onClick={() => {
                                setSignupSuccess(false);
                                setMode('login');
                                setEmail('');
                                setPassword('');
                            }}
                        >
                            Back to Log In
                        </button>
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

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className={styles.googleBtn}
                >
                    {googleLoading ? (
                        <span className={styles.spinner} />
                    ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                    )}
                    Continue with Google
                </button>

                <div className={styles.divider}>
                    <span className={styles.dividerLine} />
                    <span className={styles.dividerText}>or</span>
                    <span className={styles.dividerLine} />
                </div>

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
