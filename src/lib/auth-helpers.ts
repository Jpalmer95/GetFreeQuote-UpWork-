export function getBaseUrl(): string {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return process.env.NEXT_PUBLIC_APP_URL || 'https://getfreequote.org';
}

export function getAuthCallbackUrl(): string {
    return `${getBaseUrl()}/auth/callback`;
}
