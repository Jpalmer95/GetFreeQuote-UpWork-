'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import NotificationPanel from './NotificationPanel';
import styles from './Navbar.module.css';

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const showUser = mounted && user;

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>B</span>
                    <span className="gradient-text">BidFlow</span>
                </Link>

                <nav className={styles.navLinks}>
                    <Link
                        href="/marketplace"
                        className={`${styles.link} ${pathname === '/marketplace' ? styles.active : ''}`}
                    >
                        Marketplace
                    </Link>
                    <Link
                        href="/community"
                        className={`${styles.link} ${pathname?.startsWith('/community') ? styles.active : ''}`}
                    >
                        Community
                    </Link>
                    {showUser && (
                        <>
                            <Link
                                href="/dashboard"
                                className={`${styles.link} ${pathname === '/dashboard' ? styles.active : ''}`}
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/projects"
                                className={`${styles.link} ${pathname?.startsWith('/projects') ? styles.active : ''}`}
                            >
                                Projects
                            </Link>
                            <Link
                                href="/agent-settings"
                                className={`${styles.link} ${pathname === '/agent-settings' ? styles.active : ''}`}
                            >
                                AI Agent
                            </Link>
                            {profile?.role === 'ADMIN' && (
                                <Link
                                    href="/admin/verifications"
                                    className={`${styles.link} ${pathname?.startsWith('/admin') ? styles.active : ''}`}
                                >
                                    Admin
                                </Link>
                            )}
                        </>
                    )}
                </nav>

                <div className={styles.actions}>
                    {showUser ? (
                        <div className={styles.userMenu}>
                            <NotificationPanel />
                            <span className={styles.avatar}>
                                {(profile?.full_name?.[0] || 'U').toUpperCase()}
                            </span>
                            <span className={styles.welcome}>
                                {profile?.full_name?.split(' ')[0] || 'User'}
                            </span>
                            <button onClick={() => signOut()} className={styles.logoutBtn}>
                                Sign Out
                            </button>
                        </div>
                    ) : mounted ? (
                        <div className={styles.authButtons}>
                            <Link href="/login" className={styles.loginBtn}>Log In</Link>
                            <Link href="/login?mode=signup" className={styles.signupBtn}>Sign Up</Link>
                        </div>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
