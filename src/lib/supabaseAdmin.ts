import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (!_client) {
        if (!supabaseServiceKey) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations');
        }
        _client = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }
    return _client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getClient();
        const val = (client as any)[prop];
        if (typeof val === 'function') {
            return val.bind(client);
        }
        return val;
    },
});
