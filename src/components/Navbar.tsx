'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const pathname = usePathname();

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
                    {user && (
                        <Link
                            href="/dashboard"
                            className={`${styles.link} ${pathname === '/dashboard' ? styles.active : ''}`}
                        >
                            Dashboard
                        </Link>
                    )}
                </nav>

                <div className={styles.actions}>
                    {user ? (
                        <div className={styles.userMenu}>
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
                    ) : (
                        <div className={styles.authButtons}>
                            <Link href="/login" className={styles.loginBtn}>Log In</Link>
                            <Link href="/login?mode=signup" className={styles.signupBtn}>Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
