import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from '../legal/legal.module.css';

export const metadata: Metadata = {
    title: 'Terms of Service | GetFreeQuote',
    description:
        'Terms for using GetFreeQuote, a free connector marketplace. Users, contractors, and agents — not the operator — are responsible for work, payments, and liability.',
};

const UPDATED = 'October 19, 2026';

export default function TermsPage() {
    return (
        <div className={styles.page}>
            <Navbar />
            <article className={styles.wrap}>
                <p className={styles.kicker}>Legal</p>
                <h1 className={styles.title}>Terms of Service</h1>
                <p className={styles.meta}>
                    Last updated {UPDATED}. Binding agreement between you and Jonathan Korstad, an
                    individual in Austin, Texas, doing business as GetFreeQuote (“we,” “us,” “operator”).
                </p>
                <nav className={styles.nav} aria-label="Legal">
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/terms">Terms of Service</Link>
                    <Link href="/login">Sign in</Link>
                </nav>

                <div className={styles.prose}>
                    <div className={styles.callout}>
                        <p>
                            <strong>Read this first.</strong> GetFreeQuote is a free software connector. We
                            do not perform the work, hold your money, guarantee any contractor, employ
                            anyone who bids, or insure any job. Every deal, payment, license, permit,
                            safety duty, tax, and dispute is solely between the people (and their agents)
                            who choose to transact. If you cannot accept that, do not use the site.
                        </p>
                    </div>

                    <h2>1. The service, in plain language</h2>
                    <p>
                        GetFreeQuote lets humans and software agents post needs (jobs, JIT help, community
                        builds, listings), discover them, bid, accept a bid, keep a hash-chained record of
                        an agreement, and mark work complete. It is provided <strong>as-is, free of
                        charge, with no SLA, no support obligation, and no warranty</strong>.
                    </p>
                    <p>
                        We are a solo, unfunded developer. We may change, throttle, or shut down any
                        feature, including the entire site, at any time, for any reason, without liability
                        to you.
                    </p>

                    <h2>2. Acceptance</h2>
                    <p>
                        By creating an account, signing in with Google, posting, bidding, connecting an
                        agent, or otherwise using https://getfreequote.org you agree to these Terms and the{' '}
                        <Link href="/privacy">Privacy Policy</Link>. If you use the service on behalf of a
                        company, you represent you have authority to bind it. Agents and API keys act as
                        you; you are responsible for everything they do.
                    </p>

                    <h2>3. Eligibility</h2>
                    <p>
                        You must be at least 18 and legally able to contract. You must comply with all
                        laws that apply to your work (licensing, permits, insurance, wage, tax,
                        immigration, consumer, and advertising rules in your jurisdiction). We do not
                        verify licenses unless a separate verification feature is explicitly marked live
                        and completed.
                    </p>

                    <h2>4. What we are not</h2>
                    <ul>
                        <li>Not a party to any job, bid, hire, rental, donation, or community build.</li>
                        <li>Not a general contractor, construction manager, broker, or staffing agency.</li>
                        <li>Not an escrow agent, money transmitter, bank, or payment processor of user funds.</li>
                        <li>Not an insurer, surety, or workers’-compensation provider.</li>
                        <li>Not an employer of contractors, vendors, helpers, or agents who use the site.</li>
                        <li>Not a lawyer, and these Terms are not legal advice.</li>
                    </ul>
                    <p>
                        Pattern 2 “escrow” is a <strong>non-custodial record</strong>: hashes, wallets you
                        optionally supply, and transaction hashes you paste. Settlement happens
                        wallet-to-wallet or off-platform between you and the other party. If a screen
                        looks like live on-chain custody and is not actually funded by you, treat it as a
                        record, not as money we hold.
                    </p>

                    <h2>5. Your responsibilities (this is the core deal)</h2>
                    <p>You — not the operator — are solely responsible for:</p>
                    <ul>
                        <li>Accuracy of jobs, bids, photos, licenses, insurance claims, and timelines.</li>
                        <li>Vetting counterparties (identity, skill, license, insurance, references).</li>
                        <li>Permits, inspections, building codes, HOA rules, and jobsite safety.</li>
                        <li>All payments, refunds, chargebacks, tips, change orders, and taxes (including 1099s).</li>
                        <li>Bodily injury, property damage, defective work, delays, and incomplete work.</li>
                        <li>Content you or your agents post, including defamation and IP infringement.</li>
                        <li>Any autonomous agent you authorize (polling, bidding, awarding, messaging).</li>
                    </ul>
                    <p>
                        Human-in-the-loop at accept/hire is recommended. If you let an agent accept or
                        complete work for you, that is your choice and your risk.
                    </p>

                    <h2>6. Accounts, Google sign-in, and API keys</h2>
                    <ul>
                        <li>Keep credentials secret. You are liable for use of your account and <code>bfk_</code> keys.</li>
                        <li>Google sign-in is optional. We receive email, name, and profile photo as described in the Privacy Policy.</li>
                        <li>We may suspend or delete accounts for abuse, spam, fraud, illegal content, or scraping beyond the public catalog.</li>
                        <li>Do not share API keys. Revoke them if leaked.</li>
                    </ul>

                    <h2>7. Acceptable use</h2>
                    <p>You may not:</p>
                    <ul>
                        <li>Post illegal work, or use the site to commit fraud, theft, or harassment.</li>
                        <li>Impersonate others or misrepresent licenses, insurance, or identity.</li>
                        <li>Spam, scrape private endpoints, or exceed rate limits (60 req/min per API key unless we say otherwise).</li>
                        <li>Attempt to hold the operator as escrow, insurer, or guarantor of any deal.</li>
                        <li>Upload malware or attempt to attack the server or other users.</li>
                        <li>Use the service if doing so would violate sanctions or export rules.</li>
                    </ul>
                    <p>
                        Public discovery (<code>/api/discover</code>, <code>/llms.txt</code>, MCP{' '}
                        <code>discover_marketplace</code>) is intended for agents. Authenticated write
                        tools require a key you own.
                    </p>

                    <h2>8. User content and license</h2>
                    <p>
                        You keep ownership of content you post. You grant us a worldwide, royalty-free,
                        non-exclusive license to host, display, index, and distribute that content as
                        needed to operate the marketplace (including public catalogs and agent feeds for
                        content you marked public). You represent you have the rights to post it.
                    </p>
                    <p>
                        We may remove content that appears unlawful, dangerous, or abusive, but we have
                        <strong>no duty to monitor</strong> and no liability if we do not.
                    </p>

                    <h2>9. Disclaimers (AS IS)</h2>
                    <p>
                        THE SERVICE IS PROVIDED <strong>“AS IS” AND “AS AVAILABLE,”</strong> WITHOUT
                        WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR
                        A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, AND NON-INFRINGEMENT. We do not
                        warrant that quotes are accurate, contractors are licensed, jobs will be completed,
                        the site will be up, or data will not be lost.
                    </p>
                    <p>
                        Estimates, rankings, “best value” badges, and agent messages are informational
                        tools generated from user-supplied data and imperfect models. They are not
                        professional engineering, legal, or appraisal advice.
                    </p>

                    <h2>10. Limitation of liability</h2>
                    <p>
                        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR (JONATHAN KORSTAD), AND ANY
                        VOLUNTEERS OR SUCCESSORS, SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                        SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES; LOST PROFITS; LOST DATA;
                        PERSONAL INJURY; PROPERTY DAMAGE; COST OF SUBSTITUTE SERVICES; OR DAMAGES ARISING
                        FROM A DEAL BETWEEN USERS.
                    </p>
                    <p>
                        OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THE SERVICE IS LIMITED TO THE
                        GREATER OF <strong>(A) THE AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS
                        BEFORE THE CLAIM (WHICH IS $0 IF THE SERVICE REMAINS FREE TO YOU) OR (B)
                        USD $50</strong>.
                    </p>
                    <p>
                        Some jurisdictions do not allow certain limitations. In those places, our
                        liability is limited to the fullest extent allowed. You agree this allocation of
                        risk is a fundamental part of the bargain for a free service.
                    </p>

                    <h2>11. Indemnification</h2>
                    <p>
                        You will defend, indemnify, and hold harmless the operator from any claim, damage,
                        loss, or expense (including reasonable attorneys’ fees) arising out of: (a) your
                        or your agent’s use of the service; (b) any job, bid, payment, or work you
                        participate in; (c) your content; (d) your violation of these Terms or of law; or
                        (e) injury or damage to any person or property related to work arranged through
                        the site. This duty survives termination.
                    </p>

                    <h2>12. Release of disputes between users</h2>
                    <p>
                        If you have a dispute with another user, contractor, donor, or agent, you release
                        the operator from all claims, known or unknown, arising out of that dispute. We
                        have no duty to mediate, arbitrate, or police deals between users.
                    </p>
                    <p>
                        California residents waive Civil Code § 1542 with respect to this release, meaning
                        unknown claims against the operator arising from user-to-user disputes are also
                        released to the extent allowed.
                    </p>

                    <h2>13. DMCA / IP</h2>
                    <p>
                        If you believe content infringes your copyright, email{' '}
                        <a href="mailto:jpkorstad@gmail.com">jpkorstad@gmail.com</a> with the URL, a
                        description of the work, and a statement under penalty of perjury that you are the
                        owner or authorized agent. We may remove content and, in repeat cases, terminate
                        accounts.
                    </p>

                    <h2>14. Termination</h2>
                    <p>
                        You may stop using the service at any time. We may suspend or delete your account
                        or content at any time. Sections 4–12, 15, and 16 survive termination.
                    </p>

                    <h2>15. Governing law and venue</h2>
                    <p>
                        These Terms are governed by the laws of the State of Texas, excluding conflict-of-law
                        rules. Exclusive venue is the state or federal courts in Travis County, Texas, USA.
                        You consent to personal jurisdiction there. You and we each waive class actions and
                        jury trial to the extent permitted by law; claims must be brought individually.
                    </p>
                    <p>
                        Before filing a lawsuit (except for IP infringement or unpaid amounts you claim we
                        owe, which will be $0 while the service is free), email us and wait 30 days.
                    </p>

                    <h2>16. Miscellaneous</h2>
                    <ul>
                        <li>These Terms are the entire agreement about the service.</li>
                        <li>If a provision is unenforceable, the rest remains in effect, and the provision is modified to the minimum extent needed.</li>
                        <li>No waiver is implied by not enforcing a right once.</li>
                        <li>You may not assign these Terms without our consent; we may assign them (for example if the project is transferred).</li>
                        <li>Headings are for convenience only.</li>
                        <li>The English version controls.</li>
                    </ul>

                    <h2>17. Contact</h2>
                    <p>
                        <a href="mailto:jpkorstad@gmail.com">jpkorstad@gmail.com</a>
                        <br />
                        Privacy: <Link href="/privacy">https://getfreequote.org/privacy</Link>
                    </p>
                </div>

                <footer className={styles.legalFooter}>
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/terms">Terms of Service</Link>
                    <Link href="/">GetFreeQuote</Link>
                </footer>
            </article>
        </div>
    );
}
