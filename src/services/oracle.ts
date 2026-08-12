import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Oracle event emitter.
 *
 * Every meaningful platform event (job created, JIT listing, review, quote, etc.)
 * is written here as a signed, versioned event. A relay worker (or the future
 * paid agent-oracle) drains PENDING rows to the oracle ingest endpoint and marks
 * them EMITTED. This gives third-party agents a single, queryable, cheap-to-poll
 * source of truth without exposing the primary tables.
 */
export interface OracleEventInput {
    eventType: string;
    entityType: string;
    entityId: string;
    version?: number;
    payload?: Record<string, unknown>;
}

const SIGNING_SECRET = process.env.ORACLE_SIGNING_SECRET || '';

function sign(payload: string): string {
    if (!SIGNING_SECRET) return '';
    return createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
}

/**
 * Persist a signed event to the outbox. Best-effort: never throws so a
 * downstream emit failure can't break the primary operation.
 */
export async function emitOracleEvent(input: OracleEventInput): Promise<void> {
    try {
        const { eventType, entityType, entityId, version = 1, payload = {} } = input;
        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const canonical = `${eventType}:${entityType}:${entityId}:${version}:${JSON.stringify(payload)}`;
        const signature = sign(canonical);

        await supabaseAdmin.from('oracle_events').insert({
            event_type: eventType,
            entity_type: entityType,
            entity_id: entityId,
            version,
            payload,
            signature,
            nonce,
            status: 'PENDING',
        });
    } catch (err) {
        console.error('[oracle] emit failed (non-fatal):', err);
    }
}
