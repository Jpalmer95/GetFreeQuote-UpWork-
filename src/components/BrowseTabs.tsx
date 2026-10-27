import { usePathname } from 'next/navigation';
import Link from 'next/link';

const TABS = [
    { href: '/marketplace', label: 'Jobs', hint: 'Ask for quotes, pick a bid' },
    { href: '/local', label: 'Nearby', hint: 'Same-day work close to you' },
    { href: '/jit', label: 'Tools & gear', hint: 'Rent or buy from people nearby' },
    { href: '/community', label: 'Community builds', hint: 'Funded, shared projects' },
] as const;

/**
 * The four public browse surfaces are one product with four lenses. This bar is
 * rendered identically on each so switching costs one click and the layout,
 * filters and cards never drift apart again.
 */
export default function BrowseTabs() {
    const pathname = usePathname() || '';
    return (
        <nav className="gfq-tabs" aria-label="Browse">
            {TABS.map(tab => {
                const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className="gfq-tab"
                        aria-current={active ? 'page' : undefined}
                        title={tab.hint}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
