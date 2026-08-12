import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitOracleEvent } from '@/services/oracle';

/**
 * JIT item / tool sharing (rent-or-sell).
 *
 * GET  /api/jit/items?category=&type=&q=   -> list active listings (public)
 * POST /api/jit/items                       -> create a listing (auth required)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category') || undefined;
        const type = searchParams.get('type') || undefined;
        const q = searchParams.get('q') || undefined;

        let query = supabaseAdmin.from('item_listings').select('*').eq('is_active', true);
        if (category) query = query.eq('category', category);
        if (type) query = query.eq('listing_type', type);
        if (q) query = query.or(`item_name.ilike.%${q}%,description.ilike.%${q}%`);
        query = query.order('created_at', { ascending: false }).limit(100);

        const { data, error } = await query;
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const {
            itemName, category, description, listingType,
            sellPrice, rentPricePerDay, rentPricePerWeek, deposit,
            availableFrom, availableUntil, locationText,
            locationLat, locationLng, radiusMiles, images,
        } = body;

        if (!itemName || typeof itemName !== 'string') {
            return NextResponse.json({ success: false, error: 'itemName is required' }, { status: 400 });
        }
        const ltype = ['RENT', 'SELL', 'BOTH'].includes(listingType) ? listingType : 'RENT';

        // Resolve owner display name from profile.
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .maybeSingle();
        const ownerName = (profile?.full_name as string) || (profile?.email as string) || 'Anonymous';

        const { data, error } = await supabaseAdmin.from('item_listings').insert({
            owner_id: user.id,
            owner_name: ownerName,
            item_name: itemName,
            category: category || 'Tool',
            description: description || '',
            listing_type: ltype,
            sell_price: sellPrice ?? null,
            rent_price_per_day: rentPricePerDay ?? null,
            rent_price_per_week: rentPricePerWeek ?? null,
            deposit: deposit ?? 0,
            available_from: availableFrom || null,
            available_until: availableUntil || null,
            location_text: locationText || '',
            location_lat: locationLat ?? null,
            location_lng: locationLng ?? null,
            radius_miles: radiusMiles ?? 25,
            images: images || [],
            status: 'AVAILABLE',
            is_active: true,
        }).select().single();

        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

        // Emit to oracle outbox (non-blocking, best-effort).
        await emitOracleEvent({
            eventType: 'jit.listing_created',
            entityType: 'item_listing',
            entityId: data.id,
            payload: { itemName, category: category || 'Tool', listingType: ltype },
        });

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
