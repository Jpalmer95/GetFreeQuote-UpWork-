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
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && menuOpen) setMenuOpen(false);
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [menuOpen]);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 769px)');
        const handler = () => { if (mq.matches) setMenuOpen(false); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const showUser = mounted && user;

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                <Link href={mounted && user ? '/dashboard' : '/'} className={styles.logo}>
                    <span className={styles.logoIcon}>B</span>
                    <span className="gradient-text">BidFlow</span>
                </Link>

                <button
                    className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle navigation"
                    aria-expanded={menuOpen}
                    aria-controls="nav-body"
                >
                    <span />
                    <span />
                    <span />
                </button>

                {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}

                <div id="nav-body" className={`${styles.navBody} ${menuOpen ? styles.navBodyOpen : ''}`}>
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
                                    href="/agent-hub"
                                    className={`${styles.link} ${pathname?.startsWith('/agent-hub') ? styles.active : ''}`}
                                >
                                    Agent Hub
                                </Link>
                                <Link
                                    href="/agent-settings"
                                    className={`${styles.link} ${pathname === '/agent-settings' ? styles.active : ''}`}
                                >
                                    AI Agent
                                </Link>
                                <Link
                                    href="/settings/api-keys"
                                    className={`${styles.link} ${pathname?.startsWith('/settings') ? styles.active : ''}`}
                                >
                                    API Keys
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
            </div>
        </header>
    );
}
