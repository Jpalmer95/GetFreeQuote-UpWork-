import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    VendorProfileRow, EstimatingTemplateRow, TeamMemberRow,
    mapVendorProfileRow, mapEstimatingTemplateRow, mapTeamMemberRow,
} from '@/services/serverMappers';
import { TeamMemberRole } from '@/types';
import { hasPermission, VendorRole } from '@/services/vendorAuth';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function resolveVendorContext(userId: string, userEmail: string): Promise<{
    profileId: string;
    ownerId: string;
    role: VendorRole;
} | null> {
    const { data: ownedProfile } = await supabaseAdmin
        .from('vendor_profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .single();

    if (ownedProfile) {
        return { profileId: ownedProfile.id, ownerId: ownedProfile.user_id, role: 'owner' };
    }

    const { data: memberships } = await supabaseAdmin
        .from('team_members')
        .select('id, vendor_profile_id, role, user_id, accepted_at, vendor_profiles!inner(id, user_id)')
        .eq('email', userEmail)
        .eq('user_id', userId)
        .eq('is_active', true)
        .not('accepted_at', 'is', null);

    if (!memberships || memberships.length === 0) return null;

    const membership = memberships[0];
    if (!membership) return null;

    const vp = membership.vendor_profiles as unknown as { id: string; user_id: string };
    return {
        profileId: vp.id,
        ownerId: vp.user_id,
        role: membership.role as TeamMemberRole,
    };
}

export async function GET(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const action = req.nextUrl.searchParams.get('action');

    const ctx = await resolveVendorContext(user.id, user.email || '');

    if (action === 'context') {
        if (!ctx) return NextResponse.json({ context: null });
        const { data: profile } = await supabaseAdmin
            .from('vendor_profiles')
            .select('*')
            .eq('id', ctx.profileId)
            .single();
        return NextResponse.json({
            context: {
                profile: profile ? mapVendorProfileRow(profile as VendorProfileRow) : null,
                role: ctx.role,
            }
        });
    }

    if (action === 'templates') {
        if (!ctx) return NextResponse.json({ templates: [] });
        if (!hasPermission(ctx.role, 'estimating.view')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { data } = await supabaseAdmin
            .from('estimating_templates')
            .select('*')
            .eq('vendor_profile_id', ctx.profileId)
            .order('created_at', { ascending: false });
        return NextResponse.json({
            templates: (data || []).map(r => mapEstimatingTemplateRow(r as EstimatingTemplateRow)),
            role: ctx.role,
        });
    }

    if (action === 'team') {
        if (!ctx) return NextResponse.json({ members: [] });
        if (!hasPermission(ctx.role, 'team.view')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { data } = await supabaseAdmin
            .from('team_members')
            .select('*')
            .eq('vendor_profile_id', ctx.profileId)
            .order('invited_at', { ascending: true });
        return NextResponse.json({
            members: (data || []).map(r => mapTeamMemberRow(r as TeamMemberRow)),
            role: ctx.role,
        });
    }

    if (action === 'pending-invitations') {
        const { data } = await supabaseAdmin
            .from('team_members')
            .select('*, vendor_profiles!inner(company_name)')
            .eq('email', user.email || '')
            .is('accepted_at', null)
            .eq('is_active', true);
        return NextResponse.json({
            invitations: (data || []).map(r => ({
                id: r.id,
                companyName: (r.vendor_profiles as unknown as { company_name: string }).company_name,
                role: r.role,
                invitedAt: r.invited_at,
            })),
        });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'upsert-profile') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (ctx && !hasPermission(ctx.role, 'profile.edit')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const ownerId = ctx?.ownerId || user.id;
        const payload = {
            user_id: ownerId,
            company_name: body.companyName,
            company_description: body.companyDescription,
            contact_email: body.contactEmail,
            contact_phone: body.contactPhone,
            website: body.website || null,
            logo_url: body.logoUrl || null,
            service_areas: body.serviceAreas || [],
            industries: body.industries || [],
            specialties: body.specialties || [],
            certifications: body.certifications || [],
            insurance_details: body.insuranceDetails || null,
            insurance_expiry: body.insuranceExpiry || null,
            license_number: body.licenseNumber || null,
            year_established: body.yearEstablished || null,
            team_size: body.teamSize || 1,
            portfolio_images: body.portfolioImages || [],
            portfolio_descriptions: body.portfolioDescriptions || [],
            updated_at: new Date().toISOString(),
        };

        const existing = ctx?.profileId;
        let result;
        if (existing) {
            const { data, error } = await supabaseAdmin
                .from('vendor_profiles')
                .update(payload)
                .eq('id', existing)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            result = data;
        } else {
            const { data, error } = await supabaseAdmin
                .from('vendor_profiles')
                .insert(payload)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            result = data;
        }

        return NextResponse.json({ profile: mapVendorProfileRow(result as VendorProfileRow) });
    }

    if (action === 'create-template' || action === 'update-template') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (!ctx) return NextResponse.json({ error: 'No vendor profile found' }, { status: 404 });

        const perm = action === 'create-template' ? 'estimating.create' : 'estimating.edit';
        if (!hasPermission(ctx.role, perm)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const templatePayload = {
            vendor_profile_id: ctx.profileId,
            name: body.name,
            service_category: body.serviceCategory,
            industry_vertical: body.industryVertical,
            labor_rate: body.laborRate,
            material_markup_percent: body.materialMarkupPercent,
            minimum_charge: body.minimumCharge,
            is_default: body.isDefault,
            line_items: body.lineItems,
        };

        if (action === 'create-template') {
            const { data, error } = await supabaseAdmin
                .from('estimating_templates')
                .insert(templatePayload)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ template: mapEstimatingTemplateRow(data as EstimatingTemplateRow) });
        } else {
            const { data, error } = await supabaseAdmin
                .from('estimating_templates')
                .update({ ...templatePayload, updated_at: new Date().toISOString() })
                .eq('id', body.templateId)
                .eq('vendor_profile_id', ctx.profileId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ template: mapEstimatingTemplateRow(data as EstimatingTemplateRow) });
        }
    }

    if (action === 'delete-template') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (!ctx) return NextResponse.json({ error: 'No vendor profile found' }, { status: 404 });
        if (!hasPermission(ctx.role, 'estimating.delete')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { error } = await supabaseAdmin
            .from('estimating_templates')
            .delete()
            .eq('id', body.templateId)
            .eq('vendor_profile_id', ctx.profileId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (action === 'add-team-member') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (!ctx) return NextResponse.json({ error: 'No vendor profile found' }, { status: 404 });
        if (!hasPermission(ctx.role, 'team.manage')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { data, error } = await supabaseAdmin
            .from('team_members')
            .insert({
                vendor_profile_id: ctx.profileId,
                email: body.email,
                name: body.name,
                role: body.role,
                is_active: true,
            })
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ member: mapTeamMemberRow(data as TeamMemberRow) });
    }

    if (action === 'update-team-member') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (!ctx) return NextResponse.json({ error: 'No vendor profile found' }, { status: 404 });
        if (!hasPermission(ctx.role, 'team.manage')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.role !== undefined) updates.role = body.role;
        if (body.isActive !== undefined) updates.is_active = body.isActive;
        const { data, error } = await supabaseAdmin
            .from('team_members')
            .update(updates)
            .eq('id', body.memberId)
            .eq('vendor_profile_id', ctx.profileId)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ member: mapTeamMemberRow(data as TeamMemberRow) });
    }

    if (action === 'remove-team-member') {
        const ctx = await resolveVendorContext(user.id, user.email || '');
        if (!ctx) return NextResponse.json({ error: 'No vendor profile found' }, { status: 404 });
        if (!hasPermission(ctx.role, 'team.manage')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { error } = await supabaseAdmin
            .from('team_members')
            .delete()
            .eq('id', body.memberId)
            .eq('vendor_profile_id', ctx.profileId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (action === 'accept-invitation') {
        const { data: member } = await supabaseAdmin
            .from('team_members')
            .select('*')
            .eq('id', body.memberId)
            .single();
        if (!member) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        if (member.email !== user.email) {
            return NextResponse.json({ error: 'This invitation is for a different email address' }, { status: 403 });
        }
        if (member.accepted_at) {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
            .from('team_members')
            .update({ user_id: user.id, accepted_at: new Date().toISOString() })
            .eq('id', body.memberId)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ member: mapTeamMemberRow(data as TeamMemberRow) });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
