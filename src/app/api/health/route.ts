import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isPgConfigured } from '@/lib/pgSupabaseEngine';

const REQUIRED_TABLES = [
    'profiles',
    'jobs',
    'quotes',
    'messages',
    'agent_configs',
    'agent_actions',
    'notifications',
    'vendor_profiles',
    'projects',
    'project_phases',
    'community_projects',
    'escrow_accounts',
    'job_briefs',
    'bid_threads',
];

export async function GET() {
    const checks: Record<string, string> = {};
    let healthy = true;

    const pgActive = isPgConfigured();
    checks.backend = pgActive ? 'postgresql-16' : 'supabase';

    if (!pgActive && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
        return NextResponse.json({ healthy: false, checks }, { status: 503 });
    }

    try {
        for (const table of REQUIRED_TABLES) {
            const { error } = await supabaseAdmin.from(table).select('id').limit(1);
            if (error) {
                checks[`table:${table}`] = error.message;
                healthy = false;
            } else {
                checks[`table:${table}`] = 'ok';
            }
        }
    } catch (err: unknown) {
        checks.connection = err instanceof Error ? err.message : 'unknown error';
        healthy = false;
    }

    return NextResponse.json({ healthy, backend: checks.backend, checks }, { status: healthy ? 200 : 503 });
}
