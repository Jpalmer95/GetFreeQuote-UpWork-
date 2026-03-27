import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!_client) {
        if (!supabaseUrl) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Please add it to your environment secrets.');
        }
        if (!supabaseServiceKey) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your environment secrets to enable server-side operations like AI agent processing.');
        }
        _client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
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
                return (value as Function).bind(client);
            }
            return value;
        },
    }
);
