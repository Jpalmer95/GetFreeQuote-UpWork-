import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { createHash, randomBytes } from 'crypto';

function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { raw: string; prefix: string; hash: string } {
    const raw = `bfk_${randomBytes(32).toString('hex')}`;
    const prefix = raw.substring(0, 12);
    const hash = hashKey(raw);
    return { raw, prefix, hash };
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('api_keys')
            .select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ keys: data || [] });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const name = (body.name || '').trim().substring(0, 100);
        if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

        const scopes: string[] = Array.isArray(body.scopes) ? body.scopes : ['read', 'write'];
        const validScopes = ['read', 'write'];
        const filteredScopes = scopes.filter(s => validScopes.includes(s));
        if (filteredScopes.length === 0) return NextResponse.json({ error: 'At least one valid scope required' }, { status: 400 });

        const expiresAt: string | null = body.expires_at || null;

        const { raw, prefix, hash } = generateApiKey();

        const { data, error } = await supabaseAdmin
            .from('api_keys')
            .insert({
                user_id: user.id,
                name,
                key_hash: hash,
                key_prefix: prefix,
                scopes: filteredScopes,
                expires_at: expiresAt,
                is_active: true,
            })
            .select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ key: { ...data, raw_key: raw } }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('api_keys')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, is_active } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const update: Record<string, unknown> = {};
        if (typeof is_active === 'boolean') update.is_active = is_active;
        if (body.name) update.name = (body.name as string).trim().substring(0, 100);

        const { data, error } = await supabaseAdmin
            .from('api_keys')
            .update(update)
            .eq('id', id)
            .eq('user_id', user.id)
            .select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ key: data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
