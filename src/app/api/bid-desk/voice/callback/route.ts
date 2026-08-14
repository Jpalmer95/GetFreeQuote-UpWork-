import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { processVoicemail, notifyOwnerOfCall } from '@/services/voiceAgent';

/**
 * POST /api/bid-desk/voice/callback
 * Called by Twilio after a voicemail recording completes (or webhook transcription).
 * Body (form-encoded from Twilio): RecordingUrl, Caller, From, TranscriptionText, etc.
 * The jobId is carried as a custom parameter in the voicemail-drop TwiML action.
 */
export async function POST(request: NextRequest) {
    try {
        const form = await request.formData();
        const get = (k: string) => (form.get(k) as string | null) || undefined;
        const recordingUrl = get('RecordingUrl') || get('RecordingDownloadUrl');
        const transcriptionText = get('TranscriptionText');
        const caller = get('Caller') || get('From');
        const jobId = get('jobId');

        const result = await processVoicemail({ recordingUrl, transcriptionText, callerNumber: caller, jobId });

        // Notify the owner if a job was matched and we have a summary.
        if (result.threadId && jobId) {
            const { data: thread } = await supabaseAdmin.from('bid_threads').select('job_id').eq('id', result.threadId).single();
            const { data: job } = thread ? await supabaseAdmin.from('jobs').select('user_id').eq('id', thread.job_id).single() : { data: null };
            if (job?.user_id && result.summary) {
                await notifyOwnerOfCall({ userId: job.user_id, jobId, summary: result.summary, needsClarification: (result as any).needsClarification });
            }
        }

        return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
        console.error('[voice-callback] error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/** GET — return the voicemail-drop TwiML for an inbound call (Twilio calls this URL). */
export async function GET(request: NextRequest) {
    // For Twilio <Record action>, a GET to this route returns empty 200 (Twilio
    // posts the recording to the action URL). Twilio calls the voicemail-drop
    // TwiML from the number's voice URL (configured separately). Keep GET as a
    // no-op so the action URL pattern is uniform.
    const { buildVoicemailDropTwiML } = await import('@/services/voiceAgent');
    return new NextResponse(buildVoicemailDropTwiML(), { headers: { 'Content-Type': 'text/xml' } });
}
