import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://local.getfreequote.org';
const PLACEHOLDER_KEY = 'gfq-local-anon-key';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

const customFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (typeof window === 'undefined' && process.env.DATABASE_URL) {
        const { handleSupabaseRequest } = await import('@/lib/pgSupabaseEngine');
        const headersObj: Record<string, string> = {};
        if (init?.headers) {
            const h = new Headers(init.headers as HeadersInit);
            h.forEach((v, k) => { headersObj[k] = v; });
        }
        let bodyText: string | null = null;
        if (typeof init?.body === 'string') {
            bodyText = init.body;
        }
        const parsed = new URL(rawUrl);
        const res = await handleSupabaseRequest(
            parsed.pathname + parsed.search,
            init?.method || 'GET',
            headersObj,
            bodyText,
        );
        return new Response(init?.method === 'HEAD' ? null : (res.body as BodyInit), {
            status: res.status,
            headers: res.headers,
        });
    }

    if (typeof window !== 'undefined') {
        const parsed = new URL(rawUrl, window.location.origin);
        if (
            parsed.pathname.startsWith('/rest/v1') ||
            parsed.pathname.startsWith('/auth/v1') ||
            parsed.pathname.startsWith('/storage/v1')
        ) {
            const localUrl = `${window.location.origin}/api/supabase${parsed.pathname}${parsed.search}`;
            return fetch(localUrl, init);
        }
    }

    return fetch(input, init);
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: customFetch },
});
