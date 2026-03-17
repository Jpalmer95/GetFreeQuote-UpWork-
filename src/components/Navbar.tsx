'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css'; // We'll create this css next

export default function Navbar() {
    const { user, profile, signOut } = useAuth();

    return (
        <header className={`glass-panel ${styles.header}`}>
            <div className={styles.logoRow}>
                <Link href="/" className="gradient-text" style={{ fontWeight: 800, fontSize: '1.5rem', textDecoration: 'none' }}>
                    QuoteBot
                </Link>

                <nav className={styles.navLinks}>
                    <Link href="/marketplace" className={styles.link}>Marketplace</Link>
                    {user && <Link href="/dashboard" className={styles.link}>Dashboard</Link>}
                </nav>

                <div className={styles.actions}>
                    {user ? (
                        <div className={styles.userMenu}>
                            <span className={styles.welcome}>Hi, {profile?.full_name?.split(' ')[0] || 'User'}</span>
                            <button onClick={() => signOut()} className={styles.logoutBtn}>Sign Out</button>
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
