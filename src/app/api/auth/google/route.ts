import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthorizeUrl, googleOAuthConfigured, newOAuthState } from '@/lib/oauthState';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (!googleOAuthConfigured()) {
        return NextResponse.redirect(
            new URL('/login?error=' + encodeURIComponent('Google login is not configured yet. Use email and password, or ask the operator to add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.'), request.url)
        );
    }

    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    const state = newOAuthState(redirect);
    return NextResponse.redirect(buildGoogleAuthorizeUrl(state));
}
