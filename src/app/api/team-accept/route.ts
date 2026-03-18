import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TeamMemberRow, mapTeamMemberRow } from '@/services/serverMappers';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { memberId } = await req.json();
        if (!memberId) {
            return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
        }

        const { data: member, error: fetchErr } = await supabaseAdmin
            .from('team_members')
            .select('*')
            .eq('id', memberId)
            .single();

        if (fetchErr || !member) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        if (member.email !== user.email) {
            return NextResponse.json({ error: 'This invitation is for a different email address' }, { status: 403 });
        }

        if (member.accepted_at) {
            return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
        }

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('team_members')
            .update({ user_id: user.id, accepted_at: new Date().toISOString() })
            .eq('id', memberId)
            .select()
            .single();

        if (updateErr) {
            return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
        }

        return NextResponse.json({ member: mapTeamMemberRow(updated as TeamMemberRow) });
    } catch (err) {
        console.error('Team accept error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
