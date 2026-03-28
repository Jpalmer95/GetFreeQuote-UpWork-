import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const errorParam = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');

    const origin = requestUrl.origin.includes('localhost')
        ? `https://${process.env.REPLIT_DEV_DOMAIN || requestUrl.host}`
        : requestUrl.origin;

    if (errorParam) {
        const msg = encodeURIComponent(errorDescription || errorParam);
        return NextResponse.redirect(`${origin}/login?error=${msg}`);
    }

    if (code) {
        return NextResponse.redirect(`${origin}/auth/confirm?code=${code}`);
    }

    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Missing authentication code')}`);
}
