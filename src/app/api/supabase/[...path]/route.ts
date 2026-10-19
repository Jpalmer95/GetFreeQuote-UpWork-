import { NextRequest, NextResponse } from 'next/server';
import { handleSupabaseRequest } from '@/lib/pgSupabaseEngine';

async function handler(request: NextRequest) {
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headersObj[key] = value;
    });

    let bodyText: string | null = null;
    let bodyBuffer: Buffer | null = null;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const contentType = (request.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json') || contentType.includes('text/')) {
            bodyText = await request.text();
        } else {
            const ab = await request.arrayBuffer();
            bodyBuffer = Buffer.from(ab);
        }
    }

    const result = await handleSupabaseRequest(
        request.url,
        request.method,
        headersObj,
        bodyText,
        bodyBuffer,
    );

    if (request.method === 'HEAD') {
        return new NextResponse(null, { status: result.status, headers: result.headers });
    }

    return new NextResponse(result.body as BodyInit, {
        status: result.status,
        headers: result.headers,
    });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const HEAD = handler;
