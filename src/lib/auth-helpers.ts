function isPublicHost(host: string): boolean {
    const h = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    return !!h && h !== '0.0.0.0' && h !== '127.0.0.1' && h !== 'localhost' && h !== '::1';
}

/** Canonical public origin — never the Docker bind address 0.0.0.0:5000. */
export function getPublicOrigin(request?: { headers: { get(name: string): string | null }; nextUrl?: { origin: string } }): string {
    const env = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    if (env && isPublicHost(env)) return env;

    if (request) {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
        const proto = request.headers.get('x-forwarded-proto') || 'https';
        if (isPublicHost(host)) {
            const hostname = host.split(':')[0];
            const port = host.includes(':') ? host.split(':')[1] : '';
            const skipPort = !port || port === '80' || port === '443' || port === '5000';
            return `${proto}://${hostname}${skipPort ? '' : `:${port}`}`;
        }
        const origin = request.nextUrl?.origin || '';
        if (origin && isPublicHost(origin)) return origin.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined' && isPublicHost(window.location.host)) {
        return window.location.origin;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return 'https://getfreequote.org';
}

export function getBaseUrl(): string {
    if (typeof window !== 'undefined' && isPublicHost(window.location.host)) {
        return window.location.origin;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    const env = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    if (env && isPublicHost(env)) return env;
    return 'https://getfreequote.org';
}

export function getAuthCallbackUrl(): string {
    return `${getBaseUrl()}/auth/callback`;
}
