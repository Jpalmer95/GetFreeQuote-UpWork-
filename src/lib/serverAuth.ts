import { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/pgSupabaseEngine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string } | null> {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    let accessToken: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.slice(7).trim();
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

    const jwtPayload = verifyJwt(accessToken);
    if (jwtPayload?.sub) {
        return { id: jwtPayload.sub };
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return null;

    return { id: user.id };
}
