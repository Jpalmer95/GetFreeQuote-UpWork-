import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!auth) return null;
    const { data: { user } } = await supabase.auth.getUser(auth);
    return user;
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabaseAdmin
            .from('saved_searches')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
        return NextResponse.json(data ?? []);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { name, filters } = body;

        if (!name || !filters) {
            return NextResponse.json({ error: 'Name and filters are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('saved_searches')
            .insert({ user_id: user.id, name, filters })
            .select()
            .single();

        if (error) return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Search ID required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('saved_searches')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
