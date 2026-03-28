export function getBaseUrl(): string {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return 'http://localhost:3000';
}

export function getAuthCallbackUrl(): string {
    return `${getBaseUrl()}/auth/callback`;
}
