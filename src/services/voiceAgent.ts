/**
 * Voice Agent Service (Phase 5)
 *
 * Cheap/free phone handling. Two tiers:
 *   Tier 1 (default, ~free): inbound call → Twilio voicemail-drop (a short
 *     prompt then record) → transcription via an STT provider (local whisper
 *     by default) → normalized into a bid_message + optional extracted quote.
 *     No live-voice cost.
 *   Tier 2 (optional, gated): Twilio Media Streams (WebSocket) + STT + LLM +
 *     TTS for live conversational voice. Provider-abstracted via providers.ts
 *     so better/cheaper models swap in via env, no refactor.
 *
 * Every call produces a summary and notifies the owner if clarification is needed.
 *
 * See docs/plans/2026-08-13-hermes-agent-bid-desk.md (Phase 5).
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActiveSttProvider, getActiveLlmProvider } from '@/services/providers';
import { getAdapter } from '@/services/channelAdapters';
import type { BidThread } from '@/types';

// --- Twilio inbound call: voicemail-drop TwiML ---------------------------------
export function buildVoicemailDropTwiML(): string {
    const recordingHints =
        'Hi, you have reached the GetFreeQuote job line. Please say your name, your company, ' +
        'your quote amount, and when you can start, after the beep. You can also mention any ' +
        'exclusions. This call is recorded and transcribed for the project owner.';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${recordingHints}</Say>
  <Record maxLength="120" transcribe="true" action="/api/bid-desk/voice/callback" method="POST"/>
  <Say voice="alice">Thank you. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

// --- Process a completed voicemail recording ---------------------------------
export async function processVoicemail(params: {
    recordingUrl?: string;
    transcriptionText?: string;
    callerNumber?: string;
    jobId?: string;
}): Promise<{ threadId?: string; messageId?: string; summary?: string; error?: string }> {
    const jobId = params.jobId;
    if (!jobId) return { error: 'no jobId for voicemail' };

    // 1) Get or create a voice bid thread for this caller (keyed by caller number).
    const callerKey = params.callerNumber || `voice-${Date.now()}`;
    const voiceAdapter = getAdapter('voice');
    const contact = params.callerNumber ? { phone: params.callerNumber } : { name: 'voicemail caller' };
    const ingest = await voiceAdapter.ingestInbound({
        jobId,
        channel: 'voice',
        externalThreadKey: callerKey,
        contractorContact: contact,
        sender: params.callerNumber || 'caller',
        body: params.transcriptionText || '(voice message recorded; transcription pending)',
        raw: { recordingUrl: params.recordingUrl },
    });
    if ('error' in ingest) return { error: ingest.error };
    const { threadId, messageId } = ingest;

    // 2) If we have text, try to extract a quote amount + availability.
    let extracted: Record<string, unknown> | undefined;
    const text = params.transcriptionText || '';
    if (text) {
        const amountMatch = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
        if (amountMatch) extracted = { amount: parseFloat(amountMatch[1].replace(/,/g, '')) };
        const availMatch = text.match(/\b(start|begin|available|can start)\b[^.]*?(\w+ \d{1,2}|\d{1,2}(?:st|nd|rd|th)?)/i);
        if (availMatch) extracted = { ...extracted, availability: availMatch[0] };
        if (extracted) {
            await supabaseAdmin.from('bid_messages').update({ extracted_quote: extracted }).eq('id', messageId);
            await supabaseAdmin.from('bid_threads').update({ status: 'AWAITING_OWNER' }).eq('id', threadId);
        }
    }

    // 3) Summarize + flag clarifications via the active LLM provider (cheap).
    let summary = text ? `Voicemail from ${params.callerNumber || 'caller'}: ${text.slice(0, 300)}` : 'Voicemail recorded (no transcription).';
    let needsClarification = !text || !amountMatch0(text);
    try {
        const llm = getActiveLlmProvider();
        if (text && llm.id !== 'echo') {
            const resp = await llm.chat([
                { role: 'system', content: 'You summarize contractor voicemails into one or two crisp lines for the project owner. If any requested detail (price, availability, exclusions, license) is missing, say "NEEDS CLARIFICATION" at the end.' },
                { role: 'user', content: text },
            ], { maxTokens: 120 });
            summary = resp.trim();
            needsClarification = /NEEDS CLARIFICATION/i.test(resp);
        }
    } catch (e) {
        console.error('[voice] LLM summary failed, using raw text:', e);
    }

    return { threadId, messageId, summary, ...(needsClarification ? { needsClarification: true } : {}) };
}

function amountMatch0(text: string): boolean {
    return /\$\s?[\d,]+/.test(text);
}

// --- Tier 2 hook (optional live voice) — returns a Media Streams twiml ----------
export function buildLiveVoiceTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:5000'}/api/bid-desk/voice/stream"/>
  </Connect>
</Response>`;
}

/** Owner notification when a call needs their attention (clarification/approval). */
export async function notifyOwnerOfCall(params: { userId: string; jobId: string; summary: string; needsClarification?: boolean }) {
    // Reuse the existing notification dispatcher for consistency.
    const { dispatchNotification } = await import('@/services/notificationDispatcher');
    await dispatchNotification({
        userId: params.userId,
        jobId: params.jobId,
        type: params.needsClarification ? 'approval_needed' : 'new_message',
        priority: params.needsClarification ? 'high' : 'medium',
        title: params.needsClarification ? 'Contractor voicemail needs your input' : 'Contractor voicemail received',
        message: params.summary,
        actionRequired: !!params.needsClarification,
        actionUrl: '/dashboard',
    });
}
