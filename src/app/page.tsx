import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.heroContainer}>
        <div className={`glass-panel ${styles.heroCard}`}>
          <h1 className="gradient-text">QuoteBot Network</h1>
          <p className={styles.subtitle}>
            The Operating System for Home Services. <br />
            Sign in to manage your projects or bid on active jobs.
          </p>

          <div className={styles.actions}>
            <Link href="/login?mode=signup" className={styles.primaryButton}>
              Get Started
            </Link>
            <Link href="/login" className={styles.secondaryButton}>
              Log In
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.featuresGrid}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>AI-Powered Parsing</h3>
          <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>
            Our agents discuss details with you so you don't have to repeat yourself to 10 different contractors.
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>Instant Estimates</h3>
          <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>
            Vendors set their logic, our bots do the math. Get preliminary quotes instantly.
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3>Live Price Updates</h3>
          <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>
            Change a detail once, and all your quotes update automatically.
          </p>
        </div>
      </div>
    </main>
  );
}
