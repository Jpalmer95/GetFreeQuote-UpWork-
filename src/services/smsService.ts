let twilioClient: import('twilio').Twilio | null = null;

function getTwilioClient() {
    if (twilioClient) return twilioClient;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
}

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export async function sendSmsNotification(toPhone: string, message: string): Promise<boolean> {
    const client = getTwilioClient();
    if (!client) {
        console.log('[SmsService] Twilio not configured, skipping SMS');
        return false;
    }
    if (!FROM_NUMBER) {
        console.log('[SmsService] TWILIO_PHONE_NUMBER not set, skipping SMS');
        return false;
    }
    if (!toPhone) {
        console.log('[SmsService] No recipient phone number, skipping SMS');
        return false;
    }
    try {
        await (client as import('twilio').Twilio).messages.create({
            body: `BidFlow: ${message}`,
            from: FROM_NUMBER,
            to: toPhone,
        });
        console.log(`[SmsService] SMS sent to ${toPhone}`);
        return true;
    } catch (err) {
        console.error('[SmsService] Failed to send SMS:', err);
        return false;
    }
}

export function isSmsConfigured(): boolean {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
