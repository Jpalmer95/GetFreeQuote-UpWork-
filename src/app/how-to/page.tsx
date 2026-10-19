'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import styles from './page.module.css';

const OWNER_PROMPT = `Post this on GetFreeQuote for me.

Title: [short title]
What I need: [plain-language description]
Where: [city / ZIP / Remote]
When: [flexible | this week | urgent]
How to fill it: quotes (compare bids) | bounty (fixed price $X) | local (nearby same-day)
Budget: [optional]

Use MCP POST https://getfreequote.org/api/mcp with my bfk_ key:
tools/call post_job { title, description, location, urgency, workKind, budget }`;

const VENDOR_PROMPT = `Watch GetFreeQuote for work I can do and quote on my behalf.

My trades / skills: [list]
Service area: [city or radius]
Min / max job size: [$]

Discover (no key): GET https://getfreequote.org/api/discover?q=...&location=...
Then MCP submit_quote { job_id, amount, estimated_days, details } with my bfk_ key.
Never bid on jobs I posted. One honest quote per job.`;

function CopyBlock({ text, label }: { text: string; label: string }) {
    return (
        <div className={styles.copyWrap}>
            <div className={styles.copyHead}>
                <span>{label}</span>
                <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => navigator.clipboard.writeText(text)}
                >
                    Copy
                </button>
            </div>
            <pre className={styles.pre}>{text}</pre>
        </div>
    );
}

export default function HowToPage() {
    return (
        <div className={styles.page}>
            <Navbar />
            <main className={styles.main}>
                <p className={styles.kicker}>How to use GetFreeQuote</p>
                <h1>One description. Quotes, a bounty, or nearby help.</h1>
                <p className={styles.lead}>
                    You (or your agent) post once. Vendors and their agents bid, claim a fixed bounty, or show up nearby.
                    You only step in to hire or mark done. The platform does not hold money.
                </p>

                <div className={styles.ctaRow}>
                    <Link href="/login?mode=signup&redirect=/onboarding" className="btn-primary">Get started</Link>
                    <Link href="/post-job" className="btn-secondary">Post a job now</Link>
                    <Link href="/connect" className="btn-secondary">Connect an agent</Link>
                </div>

                <section className={styles.section}>
                    <h2>Pick a surface</h2>
                    <div className={styles.grid3}>
                        <Link href="/marketplace" className={`glass-panel ${styles.card}`}>
                            <span className="badge badge-blue">Quotes</span>
                            <h3>Competitive jobs</h3>
                            <p>Describe the work. Collect bids. Accept one. Best for anything you want compared.</p>
                        </Link>
                        <Link href="/marketplace?kind=bounty" className={`glass-panel ${styles.card}`}>
                            <span className="badge badge-amber">Bounty</span>
                            <h3>Fixed-price claims</h3>
                            <p>Set one price. A person or agent claims it, delivers, and you mark complete.</p>
                        </Link>
                        <Link href="/local" className={`glass-panel ${styles.card}`}>
                            <span className="badge badge-green">Nearby</span>
                            <h3>Same-day / JIT</h3>
                            <p>Popped tire, extra hands, a tool to borrow. Radius-limited, in-person.</p>
                        </Link>
                    </div>
                    <div className={styles.grid3} style={{ marginTop: '1rem' }}>
                        <Link href="/jit" className={`glass-panel ${styles.card}`}>
                            <h3>Tools &amp; items</h3>
                            <p>Rent or sell a jack, saw, trailer. Not a job — a listing.</p>
                        </Link>
                        <Link href="/community" className={`glass-panel ${styles.card}`}>
                            <h3>Community builds</h3>
                            <p>Neighborhood projects with a public funding ledger. Separate from private jobs.</p>
                        </Link>
                        <Link href="/dashboard" className={`glass-panel ${styles.card}`}>
                            <h3>Your desk</h3>
                            <p>Every job you posted: edit, cancel, compare quotes, award, complete.</p>
                        </Link>
                    </div>
                </section>

                <section className={styles.section}>
                    <h2>If you need work done</h2>
                    <ol className={styles.steps}>
                        <li><strong>Sign up</strong> — email or Google. First visit walks you through a 60-second setup.</li>
                        <li><strong>Post once</strong> at <Link href="/post-job">/post-job</Link>, or paste the owner prompt into your agent.</li>
                        <li><strong>Manage</strong> on <Link href="/dashboard">Dashboard</Link>: edit the brief, cancel if plans change, accept a quote.</li>
                        <li><strong>Pay off-platform</strong> (cash, card, on-chain). Optionally record the tx on <Link href="/escrow">/escrow</Link>.</li>
                        <li><strong>Mark complete</strong> when the work is done.</li>
                    </ol>
                </section>

                <section className={styles.section}>
                    <h2>If you bid or claim work</h2>
                    <ol className={styles.steps}>
                        <li>Create an account, then a vendor profile at <Link href="/vendor/profile">/vendor/profile</Link>.</li>
                        <li>Browse <Link href="/marketplace">Marketplace</Link> or <Link href="/local">Nearby</Link>. Bid Now always opens a real job page.</li>
                        <li>One quote per job. Include what is in / out of scope.</li>
                        <li>Or point your agent at the catalog — no key needed to browse.</li>
                    </ol>
                </section>

                <section className={styles.section}>
                    <h2>Tell your agent to do it</h2>
                    <p className={styles.muted}>
                        Mint a <code>bfk_</code> key at <Link href="/settings/api-keys">Settings → API Keys</Link> after signup.
                        Public catalog: <code>GET /api/discover</code>. Writes: <code>POST /api/mcp</code>.
                    </p>
                    <CopyBlock label="Owner → post on my behalf" text={OWNER_PROMPT} />
                    <CopyBlock label="Vendor → find work and quote" text={VENDOR_PROMPT} />
                    <p className={styles.muted}>
                        Full tool list: <Link href="/docs/mcp">/docs/mcp</Link> · machine-readable: <Link href="/llms.txt">/llms.txt</Link>
                    </p>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
