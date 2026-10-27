import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';

export const metadata = { title: 'Page not found | GetFreeQuote' };

const SUGGESTIONS = [
    { href: '/marketplace', label: 'Browse open jobs', hint: 'Quotes, bounties, and posted work' },
    { href: '/local', label: 'Nearby / same-day', hint: 'Work close to you' },
    { href: '/jit', label: 'Tools & gear', hint: 'Rent or buy from people nearby' },
    { href: '/community', label: 'Community builds', hint: 'Funded, shared projects' },
];

export default function NotFound() {
    return (
        <div>
            <Navbar />
            <main className="gfq-page">
                <span className="gfq-eyebrow">404</span>
                <h1 className="gfq-title">That page isn&apos;t here</h1>
                <p className="gfq-sub">
                    The link may be old, or the job may have been taken down. Everything live is one click away.
                </p>

                <div
                    style={{
                        display: 'grid',
                        gap: '0.75rem',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        marginTop: '2rem',
                        maxWidth: '900px',
                    }}
                >
                    {SUGGESTIONS.map(s => (
                        <Link
                            key={s.href}
                            href={s.href}
                            className="gfq-card"
                            style={{ padding: '1rem 1.1rem', display: 'block' }}
                        >
                            <strong style={{ display: 'block', fontSize: '0.95rem' }}>{s.label}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{s.hint}</span>
                        </Link>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '2rem' }}>
                    <Link href="/" className="btn-primary">
                        Back to home
                    </Link>
                    <Link href="/post-job" className="btn-secondary">
                        Post a job
                    </Link>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
