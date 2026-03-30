import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromRequest(req: NextRequest) {
    const auth = req.headers.get('Authorization');
    if (!auth) return null;
    const token = auth.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
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

    const updates: Record<string, unknown> = {};
    if (typeof body.phone_number === 'string') updates.phone_number = body.phone_number;
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
