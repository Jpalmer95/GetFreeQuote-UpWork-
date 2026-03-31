import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest): Promise<NextResponse> {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single();

    if (profileRow?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const pollRes = await fetch(`${appUrl}/api/poll-jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ triggered_by: 'admin_manual' }),
    });

    const data = await pollRes.json();
    return NextResponse.json(data, { status: pollRes.status });
}
