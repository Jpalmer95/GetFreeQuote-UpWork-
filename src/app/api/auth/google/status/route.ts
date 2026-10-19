import { NextResponse } from 'next/server';
import { googleOAuthConfigured, googleRedirectUri } from '@/lib/oauthState';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        configured: googleOAuthConfigured(),
        redirectUri: googleRedirectUri(),
    });
}
