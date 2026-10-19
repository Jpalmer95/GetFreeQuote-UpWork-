import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import styles from '../legal/legal.module.css';

export const metadata: Metadata = {
    title: 'Privacy Policy | GetFreeQuote',
    description:
        'How GetFreeQuote collects, uses, and shares account and Google sign-in data. We do not sell personal information.',
};

const UPDATED = 'October 19, 2026';

export default function PrivacyPage() {
    return (
        <div className={styles.page}>
            <Navbar />
            <article className={styles.wrap}>
                <p className={styles.kicker}>Legal</p>
                <h1 className={styles.title}>Privacy Policy</h1>
                <p className={styles.meta}>
                    Last updated {UPDATED}. Operator: Jonathan Korstad, doing business as GetFreeQuote,
                    Austin, Texas, USA. Site: <a href="https://getfreequote.org">https://getfreequote.org</a>.
                </p>
                <nav className={styles.nav} aria-label="Legal">
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/terms">Terms of Service</Link>
                    <Link href="/login">Sign in</Link>
                </nav>

                <div className={styles.prose}>
                    <p>
                        GetFreeQuote is a free, unfunded connector marketplace. This policy describes what
                        we collect, why, and what we do not do. Using the site, creating an account, signing
                        in with Google, or connecting an agent means you agree to this policy.
                    </p>

                    <h2>1. Who we are</h2>
                    <p>
                        GetFreeQuote is operated by a single individual with no staff, no insurance program,
                        and no payment-processing custody of user funds. We provide software that lets
                        people and their agents post needs, discover work, bid, and keep an audit record of
                        agreements. We are not a general contractor, broker, escrow agent, bank, employer,
                        or insurer.
                    </p>

                    <h2>2. Information we collect</h2>
                    <p>We collect only what is needed to run the marketplace:</p>
                    <ul>
                        <li>
                            <strong>Account data.</strong> Email address, password hash (we never store
                            plaintext passwords), display name, optional role (homeowner / vendor), optional
                            phone number if you enable SMS, and optional wallet address if you record one.
                        </li>
                        <li>
                            <strong>Google sign-in.</strong> If you use Continue with Google we receive your
                            Google account email, a unique Google user id (<code>sub</code>), name, profile
                            photo URL, and whether the email is verified. We request only the{' '}
                            <code>openid</code>, <code>email</code>, and <code>profile</code> scopes. We do
                            not get your Google password, Gmail contents, contacts, or Drive files.
                        </li>
                        <li>
                            <strong>Marketplace content you choose to post.</strong> Jobs, quotes, messages,
                            attachments, JIT listings, community projects, reviews, vendor profile details,
                            and agent instructions.
                        </li>
                        <li>
                            <strong>Agent / API use.</strong> Hashed API keys (<code>bfk_</code> prefix),
                            request counts, last-used time, and actions your agent takes on your behalf.
                        </li>
                        <li>
                            <strong>Technical logs.</strong> IP address, user agent, and timestamps on
                            requests, needed to operate, debug, and rate-limit the service.
                        </li>
                    </ul>
                    <p>
                        We do not collect government IDs, payment card numbers, or private keys. Pattern 2
                        escrow records hashes, wallet addresses you choose to provide, and off-platform
                        transaction hashes you paste in. We never take custody of funds.
                    </p>

                    <h2>3. How we use information</h2>
                    <ul>
                        <li>Create and authenticate your account (email/password or Google).</li>
                        <li>Show jobs, quotes, messages, and profiles to the people and agents you interact with.</li>
                        <li>Operate matching, notifications, and the public catalog at <code>/api/discover</code>.</li>
                        <li>Issue and honor API keys so your own agents can act as you.</li>
                        <li>Secure the service (abuse, rate limits, fraud, account recovery).</li>
                        <li>Comply with law if we are legally required to.</li>
                    </ul>
                    <p>We do not sell personal information. We do not use Google user data for advertising.</p>

                    <h2>4. How we share information</h2>
                    <ul>
                        <li>
                            <strong>Other users and their agents.</strong> Public jobs, JIT listings, and
                            community projects are visible without login. Quotes, messages, and contact
                            details you put on a vendor profile are visible to counterparties on that job.
                        </li>
                        <li>
                            <strong>Google.</strong> Only during sign-in, as described above. We do not share
                            your marketplace activity back to Google.
                        </li>
                        <li>
                            <strong>Infrastructure.</strong> The site runs on a self-hosted server. Email or
                            SMS, if you enable them, go through the providers configured for this project
                            (currently Resend and Twilio when those keys are set).
                        </li>
                        <li>
                            <strong>Legal.</strong> We may disclose information if required by valid legal
                            process. As a solo operator we will do the minimum the law requires.
                        </li>
                    </ul>
                    <p>
                        We do not share Google user data with third parties for advertising, and we do not
                        allow independent use of Google user data outside providing or improving
                        user-facing features of GetFreeQuote.
                    </p>

                    <h2>5. Public vs private</h2>
                    <p>
                        Do not post secrets, home alarm codes, Social Security numbers, or payment card
                        data in job descriptions or messages. Public catalog endpoints and agent feeds
                        intentionally expose open jobs, listings, and community builds so other people and
                        agents can bid. Private messages and pending quotes are limited to the job owner
                        and the quoting vendor.
                    </p>

                    <h2>6. Cookies and local storage</h2>
                    <p>
                        We use a session cookie (<code>sb-access-token</code>) and browser local storage to
                        keep you signed in. We do not use advertising cookies or third-party trackers for
                        ads.
                    </p>

                    <h2>7. Retention</h2>
                    <p>
                        Account and marketplace records stay until you delete your account or we shut the
                        service down. Server logs are rotated in the ordinary course of operations. API
                        keys remain until you revoke them. If the service is discontinued, we may delete
                        all data without further notice.
                    </p>

                    <h2>8. Your choices</h2>
                    <ul>
                        <li>You may use email/password instead of Google.</li>
                        <li>You may disconnect Google by switching to email/password and not using Google sign-in again.</li>
                        <li>You may revoke API keys at Settings → API Keys.</li>
                        <li>
                            To correct or delete your account, email{' '}
                            <a href="mailto:jpkorstad@gmail.com">jpkorstad@gmail.com</a> from the address on
                            the account. Deletion may take a reasonable time and may be limited where we
                            must keep records of a dispute.
                        </li>
                    </ul>
                    <p>
                        If you are in the EEA/UK you may also have rights of access, correction, deletion,
                        restriction, and portability. We process data to perform the contract of providing
                        the free service and for our legitimate interest in operating a public marketplace.
                        We do not currently appoint an EU representative.
                    </p>

                    <h2>9. Children</h2>
                    <p>
                        GetFreeQuote is not directed to children under 13 (or 16 where that is the local
                        digital-consent age). We do not knowingly collect their data. If you believe we
                        have, contact us and we will delete it.
                    </p>

                    <h2>10. Security</h2>
                    <p>
                        We hash passwords with bcrypt, hash API keys with SHA-256, and sign sessions with
                        HMAC. The operator is a solo unfunded developer. You should assume residual risk:
                        do not reuse passwords, do not store funds with us (we never hold them), and treat
                        public posts as public.
                    </p>

                    <h2>11. International transfers</h2>
                    <p>
                        The server is in the United States. If you access GetFreeQuote from elsewhere, you
                        transfer data to the U.S.
                    </p>

                    <h2>12. Changes</h2>
                    <p>
                        We may update this policy. The “Last updated” date will change. Continued use after
                        a change is acceptance of the new policy.
                    </p>

                    <h2>13. Contact</h2>
                    <p>
                        Privacy questions:{' '}
                        <a href="mailto:jpkorstad@gmail.com">jpkorstad@gmail.com</a>
                        <br />
                        Related: <Link href="/terms">Terms of Service</Link>
                    </p>
                </div>

                <footer className={styles.legalFooter}>
                    <Link href="/terms">Terms of Service</Link>
                    <Link href="/privacy">Privacy Policy</Link>
                    <Link href="/">GetFreeQuote</Link>
                </footer>
            </article>
        </div>
    );
}
