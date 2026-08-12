import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { emitOracleEvent } from '@/services/oracle';

/**
 * Vendor reviews API.
 *
 * GET  /api/reviews?vendorProfileId=<id>  -> list reviews for a vendor
 * POST /api/reviews                       -> submit a review (auth required)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vendorProfileId = searchParams.get('vendorProfileId');
        if (!vendorProfileId) {
            return NextResponse.json({ success: false, error: 'vendorProfileId is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('vendor_reviews')
            .select('*')
            .eq('vendor_profile_id', vendorProfileId)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
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
        const { vendorProfileId, jobId, rating, comment } = body as {
            vendorProfileId?: string;
            jobId?: string;
            rating?: number;
            comment?: string;
        };

        if (!vendorProfileId) {
            return NextResponse.json({ success: false, error: 'vendorProfileId is required' }, { status: 400 });
        }
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
            return NextResponse.json({ success: false, error: 'Rating must be a number between 1 and 5' }, { status: 400 });
        }

        // Resolve reviewer display name.
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .maybeSingle();
        const reviewerName = (profile?.full_name as string) || (profile?.email as string) || 'A customer';

        // Block self-review.
        const { data: vendor } = await supabaseAdmin
            .from('vendor_profiles')
            .select('user_id')
            .eq('id', vendorProfileId)
            .maybeSingle();
        if (!vendor) {
            return NextResponse.json({ success: false, error: 'Vendor profile not found' }, { status: 404 });
        }
        if ((vendor as any).user_id === user.id) {
            return NextResponse.json({ success: false, error: 'You cannot review your own vendor profile' }, { status: 400 });
        }

        // Try the atomic RPC first (if the migration was applied).
        const { data: rpcReview, error: rpcError } = await supabaseAdmin.rpc('submit_vendor_review', {
            p_vendor_profile_id: vendorProfileId,
            p_reviewer_id: user.id,
            p_reviewer_name: reviewerName,
            p_job_id: jobId || null,
            p_rating: rating,
            p_comment: comment || '',
        });

        if (!rpcError && rpcReview) {
            await emitOracleEvent({ eventType: 'review.created', entityType: 'vendor_review', entityId: rpcReview.id, payload: { vendorProfileId, rating } });
            return NextResponse.json({ success: true, data: rpcReview }, { status: 201 });
        }

        // Fallback: insert + recompute aggregates (works without the RPC).
        const { data: review, error: insertError } = await supabaseAdmin
            .from('vendor_reviews')
            .insert({
                vendor_profile_id: vendorProfileId,
                reviewer_id: user.id,
                reviewer_name: reviewerName,
                job_id: jobId || null,
                rating,
                comment: comment || '',
            })
            .select()
            .single();
        if (insertError) {
            return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
        }

        await recomputeVendorRating(vendorProfileId);
        await emitOracleEvent({ eventType: 'review.created', entityType: 'vendor_review', entityId: review.id, payload: { vendorProfileId, rating } });

        return NextResponse.json({ success: true, data: review }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

async function recomputeVendorRating(vendorProfileId: string): Promise<void> {
    const { data, error } = await supabaseAdmin
        .from('vendor_reviews')
        .select('rating')
        .eq('vendor_profile_id', vendorProfileId);
    if (error) return;

    const rows = (data as { rating: number }[]) || [];
    const avg = rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.rating, 0) / rows.length;

    await supabaseAdmin
        .from('vendor_profiles')
        .update({ avg_rating: Math.round(avg * 100) / 100, total_reviews: rows.length, updated_at: new Date().toISOString() })
        .eq('id', vendorProfileId);
}
