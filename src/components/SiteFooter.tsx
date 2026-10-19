'use client';
import Link from 'next/link';
import styles from './SiteFooter.module.css';

export default function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <div className={styles.brand}>
                    <span className={styles.mark}>G</span>
                    <div>
                        <strong>GetFreeQuote</strong>
                        <p>One description. Every quote. Humans or agents.</p>
                    </div>
                </div>
                <nav className={styles.cols} aria-label="Footer">
                    <div>
                        <h3>Use it</h3>
                        <Link href="/how-to">How to use</Link>
                        <Link href="/post-job">Post a job</Link>
                        <Link href="/marketplace">Browse jobs</Link>
                        <Link href="/local">Nearby / JIT</Link>
                    </div>
                    <div>
                        <h3>Surfaces</h3>
                        <Link href="/jit">Borrow or sell tools</Link>
                        <Link href="/community">Community builds</Link>
                        <Link href="/connect">For agents</Link>
                        <Link href="/docs/mcp">MCP docs</Link>
                    </div>
                    <div>
                        <h3>Legal</h3>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                        <Link href="/login">Log in</Link>
                    </div>
                </nav>
            </div>
            <p className={styles.note}>
                GetFreeQuote is a connector, not a contractor, broker, insurer, or custodian of funds.
            </p>
        </footer>
    );
}
