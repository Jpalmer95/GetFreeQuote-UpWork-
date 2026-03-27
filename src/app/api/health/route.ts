import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const REQUIRED_TABLES = ['profiles', 'jobs', 'quotes', 'messages', 'agent_configs', 'agent_actions', 'notifications', 'vendor_profiles', 'projects', 'project_phases', 'community_projects'];

export async function GET() {
    const checks: Record<string, string> = {};
    let healthy = true;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    checks.supabase_url = url ? 'ok' : 'missing';
    checks.service_role_key = serviceKey ? 'ok' : 'missing';

    if (!url || !serviceKey) {
        healthy = false;
        return NextResponse.json({ healthy, checks }, { status: 503 });
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

    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ healthy }, { status: healthy ? 200 : 503 });
    }
    return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 });
}
