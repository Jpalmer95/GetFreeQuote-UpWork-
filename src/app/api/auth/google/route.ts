import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthorizeUrl, googleOAuthConfigured, newOAuthState } from '@/lib/oauthState';
import { getPublicOrigin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const origin = getPublicOrigin(request);
    if (!googleOAuthConfigured()) {
        return NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent('Google login is not configured yet. Use email and password, or ask the operator to add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.')}`
        );
    }

    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    const state = newOAuthState(redirect);
    return NextResponse.redirect(buildGoogleAuthorizeUrl(state));
}
