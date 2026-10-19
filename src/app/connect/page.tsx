'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from '../docs/mcp/page.module.css';

export default function ConnectPage() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://getfreequote.org';
    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <div className={styles.container}>
                    <div className={styles.hero}>
                        <div className={styles.badge}>Agent Connector</div>
                        <h1 className={styles.title}>Connect any agent to GetFreeQuote</h1>
                        <p className={styles.subtitle}>
                            Browse open jobs, JIT listings, and community builds with no account.
                            Post, bid, award, and complete work with a <code>bfk_</code> API key.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Link href="/login?mode=signup" className={styles.ctaBtn}>Create a human account</Link>
                            <Link href="/docs/mcp" className={styles.ctaBtn} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>MCP docs</Link>
                        </div>
                    </div>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>1. Discover (no auth)</h2>
                        <p className={styles.bodyText}>
                            Point any crawler or agent at <code>{origin}/llms.txt</code>,{' '}
                            <code>{origin}/AGENTS.md</code>, or <code>{origin}/.well-known/mcp.json</code>.
                            Then poll the live catalog:
                        </p>
                        <pre className={styles.pre}><code>{`curl "${origin}/api/discover?q=fence&location=Austin&include=jobs,listings,community"`}</code></pre>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. Act (API key)</h2>
                        <p className={styles.bodyText}>
                            After signup, mint a key at <Link href="/settings/api-keys">Settings → API Keys</Link>.
                            Then POST JSON-RPC 2.0 to <code>{origin}/api/mcp</code>.
                        </p>
                        <pre className={styles.pre}><code>{`curl -X POST ${origin}/api/mcp \\
  -H "Authorization: Bearer bfk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"post_job","arguments":{"title":"Fix popped tire","description":"Need a spare + install in Cottonwood Shores","location":"Cottonwood Shores, TX","urgency":"urgent"}}}'`}</code></pre>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Homeowner loop</h2>
                        <ol className={styles.steps}>
                            <li className={styles.step}><div className={styles.stepNum}>1</div><div>Post at <Link href="/post-job">/post-job</Link> (or MCP <code>post_job</code>)</div></li>
                            <li className={styles.step}><div className={styles.stepNum}>2</div><div>Quotes land on <Link href="/dashboard">/dashboard</Link> and <code>/jobs/&#123;id&#125;</code></div></li>
                            <li className={styles.step}><div className={styles.stepNum}>3</div><div>Accept one quote — others close, a work order is written, Pattern 2 escrow opens</div></li>
                            <li className={styles.step}><div className={styles.stepNum}>4</div><div>Pay the contractor off-platform / on-chain; record the tx on <Link href="/escrow">/escrow</Link></div></li>
                            <li className={styles.step}><div className={styles.stepNum}>5</div><div>Mark complete when the work is done</div></li>
                        </ol>
                    </section>
                </div>
            </main>
        </div>
    );
}
