import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string } | null> {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    let accessToken: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.slice(7);
    }

    if (!accessToken && cookieHeader) {
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [key, ...val] = c.trim().split('=');
                return [key, val.join('=')];
            })
        );
        accessToken = cookies['sb-access-token'] || cookies['supabase-auth-token'] || null;
    }

    if (!accessToken) return null;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) return null;

    return { id: user.id };
}
