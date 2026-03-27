import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotificationEmail } from '@/services/serverEmail';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    return data?.role === 'ADMIN';
}

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const action = req.nextUrl.searchParams.get('action');

        if (action === 'my-status') {
            const { data: vendorProfile } = await supabaseAdmin
                .from('vendor_profiles')
                .select('id, is_verified')
                .eq('user_id', user.id)
                .single();

            if (!vendorProfile) {
                return NextResponse.json({ status: 'no_profile' });
            }

            if (vendorProfile.is_verified) {
                return NextResponse.json({ status: 'verified', profileId: vendorProfile.id });
            }

            const { data: latestRequest } = await supabaseAdmin
                .from('verification_requests')
                .select('*')
                .eq('vendor_profile_id', vendorProfile.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestRequest) {
                return NextResponse.json({
                    status: latestRequest.status,
                    profileId: vendorProfile.id,
                    request: {
                        id: latestRequest.id,
                        status: latestRequest.status,
                        adminNotes: latestRequest.admin_notes,
                        createdAt: latestRequest.created_at,
                        reviewedAt: latestRequest.reviewed_at,
                    },
                });
            }

            return NextResponse.json({ status: 'not_requested', profileId: vendorProfile.id });
        }

        if (action === 'admin-list') {
            if (!(await isAdmin(user.id))) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const statusFilter = req.nextUrl.searchParams.get('status') || 'pending';

            const { data, error } = await supabaseAdmin
                .from('verification_requests')
                .select('*, vendor_profiles(id, company_name, user_id, contact_email, license_number, insurance_details, certifications, logo_url)')
                .eq('status', statusFilter)
                .order('created_at', { ascending: true });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ requests: data || [] });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('[verification GET]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { action } = body;

        if (action === 'submit') {
            const { data: vendorProfile } = await supabaseAdmin
                .from('vendor_profiles')
                .select('id, is_verified')
                .eq('user_id', user.id)
                .single();

            if (!vendorProfile) {
                return NextResponse.json({ error: 'Vendor profile required' }, { status: 400 });
            }

            if (vendorProfile.is_verified) {
                return NextResponse.json({ error: 'Already verified' }, { status: 400 });
            }

            const { data: existing } = await supabaseAdmin
                .from('verification_requests')
                .select('id')
                .eq('vendor_profile_id', vendorProfile.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (existing) {
                return NextResponse.json({ error: 'You already have a pending verification request' }, { status: 400 });
            }

            const { data: request, error } = await supabaseAdmin
                .from('verification_requests')
                .insert({
                    vendor_profile_id: vendorProfile.id,
                    documents: body.documents || [],
                    license_number: body.licenseNumber || null,
                    insurance_details: body.insuranceDetails || null,
                    notes: body.notes || null,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ request });
        }

        if (action === 'review') {
            if (!(await isAdmin(user.id))) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const { requestId, decision, adminNotes } = body;
            if (!requestId || !['approved', 'rejected'].includes(decision)) {
                return NextResponse.json({ error: 'requestId and decision (approved/rejected) required' }, { status: 400 });
            }

            const { data: request, error: fetchErr } = await supabaseAdmin
                .from('verification_requests')
                .select('*, vendor_profiles(id, user_id, company_name)')
                .eq('id', requestId)
                .eq('status', 'pending')
                .single();

            if (fetchErr || !request) {
                return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 });
            }

            const { error: updateErr } = await supabaseAdmin
                .from('verification_requests')
                .update({
                    status: decision,
                    admin_notes: adminNotes || null,
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', requestId)
                .eq('status', 'pending');

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            const vendorProfile = request.vendor_profiles as unknown as { id: string; user_id: string; company_name: string };

            if (decision === 'approved') {
                await supabaseAdmin
                    .from('vendor_profiles')
                    .update({ is_verified: true, updated_at: new Date().toISOString() })
                    .eq('id', vendorProfile.id);
            }

            const notifTitle = decision === 'approved'
                ? 'Verification Approved!'
                : 'Verification Request Update';
            const notifMessage = decision === 'approved'
                ? `Congratulations! Your company "${vendorProfile.company_name}" has been verified. You now have a verified badge on your profile.`
                : `Your verification request for "${vendorProfile.company_name}" was not approved.${adminNotes ? ` Reason: ${adminNotes}` : ''} You can resubmit with updated documents.`;

            await supabaseAdmin.from('notifications').insert({
                user_id: vendorProfile.user_id,
                type: 'verification_update',
                priority: decision === 'approved' ? 'medium' : 'high',
                title: notifTitle,
                message: notifMessage,
                action_required: decision === 'rejected',
                read: false,
            });

            sendNotificationEmail(vendorProfile.user_id, 'verification_update' as any, notifTitle, notifMessage, '/vendor/profile').catch(() => {});

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('[verification POST]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
