import { NextResponse } from 'next/server';
import { googleOAuthConfigured } from '@/lib/oauthState';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({ configured: googleOAuthConfigured() });
}
