import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';

async function getUserFromRequest(req: NextRequest) {
    return getAuthenticatedUser(req);
}

export async function GET(req: NextRequest) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('phone_number, sms_enabled')
        .eq('id', user.id)
        .single();

    if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    return NextResponse.json({ phone_number: data?.phone_number || '', sms_enabled: data?.sms_enabled || false });
}

export async function PUT(req: NextRequest) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { phone_number?: string; sms_enabled?: boolean };
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const E164_RE = /^\+[1-9]\d{6,14}$/;
    const updates: Record<string, unknown> = {};
    if (typeof body.phone_number === 'string') {
        const phone = body.phone_number.trim().replace(/[\s\-().]/g, '');
        if (phone && !E164_RE.test(phone)) {
            return NextResponse.json({ error: 'Phone number must be in E.164 format, e.g. +15551234567' }, { status: 400 });
        }
        updates.phone_number = phone || null;
    }
    if (typeof body.sms_enabled === 'boolean') updates.sms_enabled = body.sms_enabled;

    const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

    if (error) {
        console.error('SMS prefs update error:', error.message);
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
}
