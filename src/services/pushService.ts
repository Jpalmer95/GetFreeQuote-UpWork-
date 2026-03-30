import webpush from 'web-push';

let initialized = false;

function initWebPush() {
    if (initialized) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@bidflow.app';
    if (!publicKey || !privateKey) {
        console.log('[PushService] VAPID keys not configured, push disabled');
        return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    initialized = true;
}

export interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export async function sendPushNotification(
    subscription: PushSubscription,
    title: string,
    body: string,
    url?: string,
): Promise<boolean> {
    initWebPush();
    if (!initialized) return false;
    if (!subscription?.endpoint) return false;

    const payload = JSON.stringify({ title, body, url });
    try {
        await webpush.sendNotification(subscription as webpush.PushSubscription, payload);
        console.log('[PushService] Push sent to', subscription.endpoint.substring(0, 40) + '...');
        return true;
    } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
            console.log('[PushService] Subscription expired or invalid');
        } else {
            console.error('[PushService] Failed to send push:', err);
        }
        return false;
    }
}

export function isPushConfigured(): boolean {
    return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
