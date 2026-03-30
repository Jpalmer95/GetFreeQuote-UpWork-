import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmailNotification, EmailPreferences } from '@/services/emailService';
import { sendSmsNotification } from '@/services/smsService';
import { sendPushNotification, PushSubscription } from '@/services/pushService';

const SMS_PRIORITY_THRESHOLD = new Set(['high', 'urgent']);
const PUSH_PRIORITY_THRESHOLD = new Set(['medium', 'high', 'urgent']);

interface DispatchParams {
    userId: string;
    jobId?: string | null;
    type: string;
    priority: string;
    title: string;
    message: string;
    actionRequired: boolean;
    actionUrl?: string;
}

interface UserProfile {
    email?: string | null;
    email_preferences?: EmailPreferences | null;
    phone_number?: string | null;
    sms_enabled?: boolean;
    push_enabled?: boolean;
    push_subscription?: PushSubscription | null;
}

export async function dispatchNotification(params: DispatchParams): Promise<void> {
    const { userId, jobId, type, priority, title, message, actionRequired, actionUrl } = params;

    await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        job_id: jobId || null,
        type,
        priority,
        title,
        message,
        action_required: actionRequired,
        action_url: actionUrl,
        read: false,
    });

    let profile: UserProfile | null = null;
    try {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('email, email_preferences, phone_number, sms_enabled, push_enabled, push_subscription')
            .eq('id', userId)
            .single();
        profile = data as UserProfile | null;
    } catch {
        profile = null;
    }

    if (!profile) return;

    if (profile.email) {
        sendEmailNotification({
            recipientEmail: profile.email,
            recipientUserId: userId,
            notificationType: type,
            title,
            message,
            actionUrl,
            emailPreferences: profile.email_preferences || null,
        }).catch(() => {});
    }

    if (profile.sms_enabled && profile.phone_number && SMS_PRIORITY_THRESHOLD.has(priority)) {
        const smsBody = actionUrl
            ? `${title}: ${message} — View: ${process.env.NEXT_PUBLIC_APP_URL || ''}${actionUrl}`
            : `${title}: ${message}`;
        sendSmsNotification(profile.phone_number, smsBody).catch(() => {});
    }

    if (profile.push_enabled && profile.push_subscription && PUSH_PRIORITY_THRESHOLD.has(priority)) {
        const sub = profile.push_subscription as PushSubscription;
        sendPushNotification(sub, title, message, actionUrl).catch(() => {});
    }
}
