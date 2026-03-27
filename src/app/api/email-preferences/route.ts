import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { DEFAULT_EMAIL_PREFERENCES } from '@/services/emailService';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('email_preferences')
            .eq('id', user.id)
            .single();

        if (error) {
            return NextResponse.json({ preferences: DEFAULT_EMAIL_PREFERENCES });
        }

        return NextResponse.json({
            preferences: data.email_preferences || DEFAULT_EMAIL_PREFERENCES,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { preferences } = await request.json();
        if (!preferences || typeof preferences !== 'object') {
            return NextResponse.json({ error: 'preferences object required' }, { status: 400 });
        }

        const validKeys = Object.keys(DEFAULT_EMAIL_PREFERENCES);
        const sanitized: Record<string, boolean> = {};
        for (const key of validKeys) {
            sanitized[key] = typeof preferences[key] === 'boolean' ? preferences[key] : (DEFAULT_EMAIL_PREFERENCES as Record<string, boolean>)[key];
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ email_preferences: sanitized })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating email preferences:', error);
            return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
        }

        return NextResponse.json({ preferences: sanitized });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') ? 503 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
