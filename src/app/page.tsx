import Link from 'next/link';
import PlatformStats from '@/components/PlatformStats';
import styles from './page.module.css';

const VERTICALS = [
    { icon: '🏠', label: 'Home Services', desc: 'Plumbing, electrical, HVAC, roofing & more' },
    { icon: '🏗️', label: 'Commercial Construction', desc: 'General contracting, site work, steel & concrete' },
    { icon: '⚡', label: 'Gig Work', desc: 'Delivery, moving, assembly, personal tasks' },
    { icon: '🎪', label: 'Events & Entertainment', desc: 'Catering, DJs, photography, venues' },
    { icon: '🔧', label: 'Trade Labor', desc: 'Welding, carpentry, masonry, flooring' },
    { icon: '💼', label: 'Professional Services', desc: 'Consulting, legal, architecture, design' },
];

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.auroraWrap}>
        <div className={styles.aurora} />
      </div>

      <section className={styles.hero}>
        <div className={styles.eyebrow}>
          <span className={styles.liveDot} />
          AI-Native Estimate Marketplace
        </div>

        <h1 className={styles.headline}>
          One Post. Every Quote.<br />
          <span className="gradient-text">Any Industry.</span>
        </h1>

        <p className={styles.subtitle}>
          Post your project once and let AI agents gather bids from verified professionals automatically — no more juggling calls, texts, and emails across dozens of vendors.
        </p>

        <div className={styles.actions}>
          <Link href="/login?mode=signup" className="btn-primary">
            Get Started Free
          </Link>
          <div className={styles.browseLinks}>
            <Link href="/marketplace" className="btn-secondary">
              Browse Marketplace
            </Link>
            <Link href="/community" className="btn-secondary">
              Browse Community Projects
            </Link>
          </div>
        </div>

        <div className={styles.trustBar}>
          <span>Home Services</span>
          <span className={styles.divider}>·</span>
          <span>Commercial Builds</span>
          <span className={styles.divider}>·</span>
          <span>Gig Work</span>
          <span className={styles.divider}>·</span>
          <span>Events</span>
          <span className={styles.divider}>·</span>
          <span>Trade Labor</span>
          <span className={styles.divider}>·</span>
          <span>& More</span>
        </div>
      </section>

      <PlatformStats />

      <section className={styles.featuresSection}>
        <div className={styles.sectionLabel}>How It Works</div>
        <div className={styles.featuresGrid}>
          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>
            <h3>Post Any Project</h3>
            <p>From fixing a faucet to building a commercial property — describe what you need and your AI agent takes it from there.</p>
          </div>

          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h3>AI Agents Negotiate</h3>
            <p>Your agent fields questions from vendors, clarifies scope, and gathers quotes — only asking you when it truly needs your input.</p>
          </div>

          <div className={`glass-panel ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.iconGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <h3>Compare & Decide</h3>
            <p>Review consolidated bids side-by-side. Change a detail and all quotes update automatically across every vendor.</p>
          </div>
        </div>
      </section>

      <section className={styles.verticalsSection}>
        <div className={styles.sectionLabel}>Works For Every Industry</div>
        <div className={styles.verticalsGrid}>
          {VERTICALS.map(v => (
            <div key={v.label} className={`glass-panel ${styles.verticalCard}`}>
              <span className={styles.verticalIcon}>{v.icon}</span>
              <h4>{v.label}</h4>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={`glass-panel ${styles.ctaCard}`}>
          <h2>Ready to simplify your quoting process?</h2>
          <p>Whether you need a single handyman or bids for a multi-phase commercial build, BidFlow has you covered.</p>
          <Link href="/login?mode=signup" className="btn-primary">
            Create Free Account
          </Link>
        </div>
      </section>
    </main>
  );
}
