import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://local.getfreequote.org';
const PLACEHOLDER_KEY = 'gfq-local-service-role-key';

let _client: SupabaseClient | null = null;

const serverPgFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (process.env.DATABASE_URL) {
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

    return fetch(input, init);
};

export function getSupabaseAdmin(): SupabaseClient {
    if (!_client) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY;
        _client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
            global: { fetch: serverPgFetch },
        });
    }
    return _client;
}

export const supabaseAdmin: SupabaseClient = new Proxy(
    {} as SupabaseClient,
    {
        get(_target: SupabaseClient, prop: string | symbol): unknown {
            const client = getSupabaseAdmin();
            const value = client[prop as keyof SupabaseClient];
            if (typeof value === 'function') {
                return (value as (...args: unknown[]) => unknown).bind(client);
            }
            return value;
        },
    }
);
