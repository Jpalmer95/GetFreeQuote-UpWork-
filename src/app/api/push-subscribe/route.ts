import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

const PRIVATE_IP_RE = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|127\.\d+\.\d+\.\d+|::1|localhost|0\.0\.0\.0)/i;

function isValidPushEndpoint(endpoint: unknown): endpoint is string {
    if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:') return false;
    if (PRIVATE_IP_RE.test(url.hostname)) return false;
    return true;
}

function isValidPushKeys(keys: unknown): keys is { p256dh: string; auth: string } {
    if (!keys || typeof keys !== 'object') return false;
    const k = keys as Record<string, unknown>;
    return typeof k.p256dh === 'string' && k.p256dh.length > 0
        && typeof k.auth === 'string' && k.auth.length > 0;
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { subscription } = body;

        if (!subscription || typeof subscription !== 'object') {
            return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
        }

        if (!isValidPushEndpoint(subscription.endpoint)) {
            return NextResponse.json(
                { error: 'Invalid subscription endpoint: must be an HTTPS URL to a public push service' },
                { status: 400 }
            );
        }

        if (!isValidPushKeys(subscription.keys)) {
            return NextResponse.json({ error: 'Invalid subscription keys' }, { status: 400 });
        }

        const sanitizedSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: String(subscription.keys.p256dh),
                auth: String(subscription.keys.auth),
            },
        };

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                push_subscription: sanitizedSubscription,
                push_enabled: true,
            })
            .eq('id', user.id);

        if (error) {
            console.error('[push-subscribe] Update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({
                push_subscription: null,
                push_enabled: false,
            })
            .eq('id', user.id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
