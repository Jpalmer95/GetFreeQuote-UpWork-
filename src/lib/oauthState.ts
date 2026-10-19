import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

function secret(): string {
    return process.env.GFQ_JWT_SECRET || process.env.ORACLE_SIGNING_SECRET || 'gfq-self-hosted-pg16-jwt-secret-2026';
}

export function signOAuthState(payload: { nonce: string; redirect: string; exp: number }): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): { nonce: string; redirect: string; exp: number } | null {
    try {
        const [body, sig] = state.split('.');
        if (!body || !sig) return null;
        const expected = createHmac('sha256', secret()).update(body).digest('base64url');
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
            nonce: string;
            redirect: string;
            exp: number;
        };
        if (!payload.nonce || payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (typeof payload.redirect !== 'string' || !payload.redirect.startsWith('/') || payload.redirect.startsWith('//')) {
            payload.redirect = '/dashboard';
        }
        return payload;
    } catch {
        return null;
    }
}

export function newOAuthState(redirect: string): string {
    const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/dashboard';
    return signOAuthState({
        nonce: randomBytes(16).toString('hex'),
        redirect: safe,
        exp: Math.floor(Date.now() / 1000) + 600,
    });
}

export function googleOAuthConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI || 'https://getfreequote.org/api/auth/google/callback';
}

export function buildGoogleAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        redirect_uri: googleRedirectUri(),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'online',
        prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
