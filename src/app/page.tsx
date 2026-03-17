import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.auroraWrap}>
        <div className={styles.aurora} />
      </div>

      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <span className={styles.liveDot} />
          AI-Powered Home Services Platform
        </div>

        <h1 className={styles.headline}>
          The Operating System<br />
          <span className="gradient-text">for Home Services</span>
        </h1>

        <p className={styles.subtitle}>
          Post a job once. Our AI agents gather quotes from verified contractors automatically — saving you hours of back-and-forth.
        </p>

        <div className={styles.actions}>
          <Link href="/login?mode=signup" className="btn-primary">
            Get Started Free
          </Link>
          <Link href="/login" className="btn-secondary">
            Log In
          </Link>
        </div>

        <div className={styles.trustBar}>
          <span>Trusted by 2,400+ homeowners</span>
          <span className={styles.divider}>·</span>
          <span>10,000+ quotes processed</span>
          <span className={styles.divider}>·</span>
          <span>Average savings: 23%</span>
        </div>
      </section>

      <section className={styles.featuresSection}>
        <div className={styles.featuresGrid}>
          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>
            <h3>AI-Powered Parsing</h3>
            <p>Our agents discuss details with you so you don't have to repeat yourself to 10 different contractors.</p>
          </div>

          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h3>Instant Estimates</h3>
            <p>Vendors set their logic, our bots do the math. Get preliminary quotes the moment you post.</p>
          </div>

          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <h3>Live Price Updates</h3>
            <p>Change a detail once, and all your quotes update automatically across every vendor.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
