/**
 * Channel Adapters — GetFreeQuote Bid Desk
 *
 * THE KEY LONGEVITY LAYER. Every channel (native inbox, email, SMS, Thumbtack
 * browser chat, voice) implements the SAME `ChannelAdapter` interface. The rest
 * of the system talks to a `ChannelRegistry` — never to a specific provider —
 * so swapping email vendors, adding a new marketplace, or upgrading the voice
 * provider is a single-file change, not a refactor.
 *
 * Contract: an adapter is responsible for (a) turning an inbound external
 * message into a normalized `bid_messages` row on the correct thread, and
 * (b) actually delivering an outbound `bid_messages` row to the contractor
 * through that channel. Adapters are idempotent by `external_thread_key`.
 *
 * See docs/plans/2026-08-13-hermes-agent-bid-desk.md (Phase 2 + longevity).
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { BidChannel, BidThread } from '@/types';

export interface InboundMessageInput {
    jobId: string;
    channel: BidChannel;
    externalThreadKey: string;          // stable key for this conversation on the channel
    contractorContact?: Record<string, unknown>;
    sender: string;
    body: string;
    raw?: Record<string, unknown>;
    extractedQuote?: Record<string, unknown>;
}

export interface OutboundDelivery {
    ok: boolean;
    error?: string;
    provider?: string;
    messageId?: string;
}

export interface ChannelAdapter {
    readonly channel: BidChannel;
    /** Record an inbound message (creating/finding its thread) and deliver it to the bid inbox. */
    ingestInbound(input: InboundMessageInput): Promise<{ threadId: string; messageId?: string } | { error: string }>;
    /** Actually send an outbound message to the contractor over this channel. */
    deliverOutbound(thread: BidThread, body: string): Promise<OutboundDelivery>;
}

// ---------------------------------------------------------------------------
// Shared helper: find-or-create the bid thread, then insert the message.
// ---------------------------------------------------------------------------
async function getOrCreateBidThread(input: InboundMessageInput): Promise<BidThread | null> {
    // find by (channel, external_thread_key)
    const { data: existing } = await supabaseAdmin
        .from('bid_threads')
        .select('*')
        .eq('channel', input.channel)
        .eq('external_thread_key', input.externalThreadKey)
        .maybeSingle();
    if (existing) {
        if (input.contractorContact && Object.keys(input.contractorContact).length) {
            await supabaseAdmin.from('bid_threads').update({ contractor_contact: input.contractorContact }).eq('id', existing.id);
        }
        return existing as BidThread;
    }
    const { data, error } = await supabaseAdmin
        .from('bid_threads')
        .insert({
            job_id: input.jobId,
            channel: input.channel,
            external_thread_key: input.externalThreadKey,
            contractor_contact: input.contractorContact || {},
            status: 'OPEN',
        })
        .select()
        .single();
    if (error) {
        console.error('[channelAdapters] getOrCreateBidThread error:', error.message);
        return null;
    }
    return data as BidThread;
}

async function recordInboundMessage(thread: BidThread, input: InboundMessageInput): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('bid_messages')
        .insert({
            thread_id: thread.id,
            direction: 'in',
            sender: input.sender,
            recipient: 'owner',
            body: input.body,
            raw: input.raw || {},
            extracted_quote: input.extractedQuote || null,
            is_agent_action: false,
        })
        .select('id')
        .single();
    if (error) {
        console.error('[channelAdapters] recordInboundMessage error:', error.message);
        return null;
    }
    return data.id;
}

// ---------------------------------------------------------------------------
// NATIVE adapter — GetFreeQuote's own inbox (inbound via agent endpoints;
// outbound is already delivered by writing to bid_messages).
// ---------------------------------------------------------------------------
export const nativeAdapter: ChannelAdapter = {
    channel: 'native',
    async ingestInbound(input) {
        const thread = await getOrCreateBidThread(input);
        if (!thread) return { error: 'failed to create thread' };
        const messageId = await recordInboundMessage(thread, input);
        return { threadId: thread.id, messageId: messageId || undefined };
    },
    async deliverOutbound(thread, body) {
        const { error } = await supabaseAdmin.from('bid_messages').insert({
            thread_id: thread.id,
            direction: 'out',
            sender: 'owner-agent',
            recipient: (thread.contractor_contact as { name?: string })?.name || 'contractor',
            body,
            is_agent_action: true,
        });
        return error ? { ok: false, error: error.message, provider: 'native' } : { ok: true, provider: 'native' };
    },
};

// ---------------------------------------------------------------------------
// EMAIL adapter — Resend (already a dependency) for outbound; inbound arrives
// via the IMAP poller or a mail webhook and is passed to ingestInbound().
// ---------------------------------------------------------------------------
export const emailAdapter: ChannelAdapter = {
    channel: 'email',
    async ingestInbound(input) {
        const thread = await getOrCreateBidThread(input);
        if (!thread) return { error: 'failed to create thread' };
        const messageId = await recordInboundMessage(thread, input);
        return { threadId: thread.id, messageId: messageId || undefined };
    },
    async deliverOutbound(thread, body) {
        const { Resend } = require('resend');
        const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
        if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured', provider: 'email' };
        const to = (thread.contractor_contact as { email?: string })?.email;
        if (!to) return { ok: false, error: 'no contractor email on thread', provider: 'email' };
        const from = process.env.BID_DESK_FROM_EMAIL || 'GetFreeQuote <bids@getfreequote.org>';
        try {
            const { error } = await resend.emails.send({ from, to, subject: 'Your quote request', text: body });
            return error ? { ok: false, error: error.message, provider: 'email' } : { ok: true, provider: 'email' };
        } catch (err: any) {
            return { ok: false, error: err?.message || 'email send failed', provider: 'email' };
        }
    },
};

// ---------------------------------------------------------------------------
// SMS adapter — Twilio (already a dependency).
// ---------------------------------------------------------------------------
export const smsAdapter: ChannelAdapter = {
    channel: 'sms',
    async ingestInbound(input) {
        const thread = await getOrCreateBidThread(input);
        if (!thread) return { error: 'failed to create thread' };
        const messageId = await recordInboundMessage(thread, input);
        return { threadId: thread.id, messageId: messageId || undefined };
    },
    async deliverOutbound(thread, body) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER;
        const to = (thread.contractor_contact as { phone?: string })?.phone;
        if (!accountSid || !authToken || !from || !to) {
            return { ok: false, error: 'Twilio not configured or no contractor phone', provider: 'sms' };
        }
        try {
            const twilio = require('twilio');
            const client = twilio(accountSid, authToken);
            await client.messages.create({ body, from, to });
            return { ok: true, provider: 'sms' };
        } catch (err: any) {
            return { ok: false, error: err?.message || 'SMS send failed', provider: 'sms' };
        }
    },
};

// ---------------------------------------------------------------------------
// THUMBTACK adapter — NO public homeowner API. This is a best-effort browser-
// automation adapter (computer-use/browser-use drives the pro-chat UI). It is
// human-gated (login/CAPTCHA) and NON-critical-path. Inbound and outbound both
// pass through the browser session; the body text is normalized into bid_messages.
// ---------------------------------------------------------------------------
export const thumbtackAdapter: ChannelAdapter = {
    channel: 'thumbtack',
    async ingestInbound(input) {
        const thread = await getOrCreateBidThread(input);
        if (!thread) return { error: 'failed to create thread' };
        const messageId = await recordInboundMessage(thread, input);
        return { threadId: thread.id, messageId: messageId || undefined };
    },
    async deliverOutbound(_thread, _body) {
        // NOTE: real delivery requires a live Thumbtack browser session (human-
        // gated login/CAPTCHA). Plug the browser-use driver here when available.
        // We record the intent via ingestOutbound intent in bid_messages elsewhere,
        // so the system remains correct even before this adapter is fully wired.
        return { ok: false, error: 'thumbtack browser adapter not yet wired (human-gated login required)', provider: 'thumbtack' };
    },
};

// ---------------------------------------------------------------------------
// VOICE adapter — voicemail-drop first (free); optional live media-streams later.
// Inbound: a Twilio call → transcription via STT provider → ingestInbound().
// Outbound: (usually none for voicemail-drop; a live agent could call back).
// ---------------------------------------------------------------------------
export const voiceAdapter: ChannelAdapter = {
    channel: 'voice',
    async ingestInbound(input) {
        const thread = await getOrCreateBidThread(input);
        if (!thread) return { error: 'failed to create thread' };
        const messageId = await recordInboundMessage(thread, input);
        return { threadId: thread.id, messageId: messageId || undefined };
    },
    async deliverOutbound(_thread, _body) {
        return { ok: false, error: 'voice outbound not enabled (voicemail-drop inbound only by default)', provider: 'voice' };
    },
};

// ---------------------------------------------------------------------------
// Registry — the only thing the rest of the system imports.
// ---------------------------------------------------------------------------
export const channelRegistry: Record<BidChannel, ChannelAdapter> = {
    native: nativeAdapter,
    email: emailAdapter,
    sms: smsAdapter,
    thumbtack: thumbtackAdapter,
    voice: voiceAdapter,
};

export function getAdapter(channel: BidChannel): ChannelAdapter {
    return channelRegistry[channel] || nativeAdapter;
}

/** Dispatch an outbound message to a thread via its channel adapter. */
export async function dispatchOutbound(thread: BidThread, body: string) {
    return getAdapter(thread.channel).deliverOutbound(thread, body);
}
