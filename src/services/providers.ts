/**
 * Provider Registry — LLM + Voice provider abstraction (THE LONGEVITY LAYER)
 *
 * The whole bid desk talks to providers through these tiny interfaces, never to a
 * specific vendor SDK. When a better LLM or a better/cheaper voice model ships,
 * you add a new provider object here (or in a new file) and flip an env var —
 * no refactor of the bid-desk flow.
 *
 * Two registries:
 *   1. LLM registry — for negotiation drafting / quote extraction / summarization.
 *   2. Voice/STT/TTS registry — for the voice agent (transcription + optional TTS).
 *
 * Each provider is a stateless object that reads its own env vars at call time,
 * so switching is just configuration.
 */

// ---------------------------------------------------------------------------
// LLM providers
// ---------------------------------------------------------------------------
export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
    role: LlmRole;
    content: string;
}

export interface LlmProvider {
    readonly id: string;
    /** Send a chat completion; returns the assistant text. */
    chat(messages: LlmMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
    /** Cheap test that the provider is configured. */
    isConfigured(): boolean;
}

/** No-cost provider: returns canned responses. Useful for offline/dev + tests. */
export const echoLlmProvider: LlmProvider = {
    id: 'echo',
    isConfigured: () => true,
    async chat(messages) {
        return messages[messages.length - 1]?.content ?? '';
    },
};

/** Generic OpenAI-compatible chat provider (works for any /v1/chat/completions endpoint). */
export function createOpenAiCompatibleLlm(opts: {
    id: string;
    baseUrl: string;    // e.g. https://api.openai.com/v1 or any OpenAI-compatible gateway
    apiKeyEnv: string;  // env var name holding the key
    model: string;
}): LlmProvider {
    return {
        id: opts.id,
        isConfigured: () => !!process.env[opts.apiKeyEnv],
        async chat(messages, o) {
            const key = process.env[opts.apiKeyEnv];
            if (!key) throw new Error(`${opts.id}: ${opts.apiKeyEnv} not configured`);
            const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                    model: opts.model,
                    messages,
                    temperature: o?.temperature ?? 0.4,
                    max_tokens: o?.maxTokens,
                }),
            });
            if (!res.ok) {
                const body = await res.text();
                throw new Error(`${opts.id} error ${res.status}: ${body.slice(0, 200)}`);
            }
            const data = await res.json();
            return data?.choices?.[0]?.message?.content ?? '';
        },
    };
}

/** Select the active LLM based on env. Defaults to echo if nothing configured. */
export function getActiveLlmProvider(): LlmProvider {
    const configured = llmRegistry.find(p => p.isConfigured());
    return configured || echoLlmProvider;
}

export const llmRegistry: LlmProvider[] = [
    createOpenAiCompatibleLlm({
        id: 'openai',
        baseUrl: process.env.BID_LLM_BASE_URL || 'https://api.openai.com/v1',
        apiKeyEnv: 'BID_LLM_API_KEY',
        model: process.env.BID_LLM_MODEL || 'gpt-4o-mini',
    }),
    createOpenAiCompatibleLlm({
        id: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1', // OpenAI-compatible via gateway when configured
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    }),
];

// ---------------------------------------------------------------------------
// STT (speech-to-text) providers — for the voice agent
// ---------------------------------------------------------------------------
export interface SttProvider {
    readonly id: string;
    /** Transcribe an audio buffer (wav/mp3/m4a). Returns plain text. */
    transcribe(audio: Buffer | Blob, opts?: { language?: string }): Promise<string>;
    isConfigured(): boolean;
}

/** Free/local STT: runs whisper via faster-whisper if a runner script is configured. */
export const localWhisperStt: SttProvider = {
    id: 'local-whisper',
    isConfigured: () => !!process.env.WHISPER_RUNNER,
    async transcribe(audio, _o) {
        // The runner script path reads the audio from a temp file and prints text.
        // Keep as a thin shell so you can swap faster-whisper / whisper.cpp / etc.
        throw new Error('localWhisperStt needs WHISPER_RUNNER wiring (see phase 5 notes)');
    },
};

export const sttRegistry: SttProvider[] = [localWhisperStt];

export function getActiveSttProvider(): SttProvider | null {
    return sttRegistry.find(p => p.isConfigured()) || null;
}

// ---------------------------------------------------------------------------
// TTS (text-to-speech) providers — for optional live voice
// ---------------------------------------------------------------------------
export interface TtsProvider {
    readonly id: string;
    /** Synthesize text to an audio buffer. */
    synthesize(text: string, opts?: { voice?: string }): Promise<Buffer>;
    isConfigured(): boolean;
}

export const ttsRegistry: TtsProvider[] = []; // add piper/elevenlabs/edge here

export function getActiveTtsProvider(): TtsProvider | null {
    return ttsRegistry.find(p => p.isConfigured()) || null;
}
