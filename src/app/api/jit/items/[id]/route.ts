import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitOracleEvent } from '@/services/oracle';

/**
 * JIT item listing by id.
 *
 * GET    /api/jit/items/:id   -> single listing (public)
 * PATCH  /api/jit/items/:id   -> update (owner only)
 * DELETE /api/jit/items/:id   -> delete (owner only)
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { data, error } = await supabaseAdmin.from('item_listings').select('*').eq('id', id).maybeSingle();
        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

        const { id } = await params;
        const { data: existing, error: fetchErr } = await supabaseAdmin
            .from('item_listings').select('*').eq('id', id).maybeSingle();
        if (fetchErr || !existing) {
            return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
        }
        if (existing.owner_id !== user.id) {
            return NextResponse.json({ success: false, error: 'You can only update your own listings' }, { status: 403 });
        }

        const body = await request.json();
        const { data, error } = await supabaseAdmin
            .from('item_listings').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

        await emitOracleEvent({ eventType: 'jit.listing_updated', entityType: 'item_listing', entityId: id, payload: { status: body.status } });
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

        const { id } = await params;
        const { data: existing, error: fetchErr } = await supabaseAdmin
            .from('item_listings').select('owner_id').eq('id', id).maybeSingle();
        if (fetchErr || !existing) {
            return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
        }
        if (existing.owner_id !== user.id) {
            return NextResponse.json({ success: false, error: 'You can only delete your own listings' }, { status: 403 });
        }

        const { error } = await supabaseAdmin.from('item_listings').delete().eq('id', id);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

        await emitOracleEvent({ eventType: 'jit.listing_deleted', entityType: 'item_listing', entityId: id });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
