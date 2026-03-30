import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmailNotification, EmailPreferences } from '@/services/emailService';
import { sendSmsNotification } from '@/services/smsService';
import { sendPushNotification, PushSubscription } from '@/services/pushService';

const SMS_PRIORITY_THRESHOLD = new Set(['high', 'urgent']);
const PUSH_PRIORITY_THRESHOLD = new Set(['medium', 'high', 'urgent']);

const E164_RE = /^\+[1-9]\d{6,14}$/;

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

    const { error: insertError } = await supabaseAdmin.from('notifications').insert({
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

    if (insertError) {
        console.error('[dispatchNotification] Failed to insert notification:', insertError.message);
    }

    let profile: UserProfile | null = null;
    const { data, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email, email_preferences, phone_number, sms_enabled, push_enabled, push_subscription')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error('[dispatchNotification] Failed to fetch profile for outbound channels:', profileError.message);
    } else {
        profile = data as UserProfile | null;
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
        }).catch(err => console.error('[dispatchNotification] Email send error:', err));
    }

    const phone = profile.phone_number?.trim();
    if (profile.sms_enabled && phone && E164_RE.test(phone) && SMS_PRIORITY_THRESHOLD.has(priority)) {
        const smsBody = actionUrl
            ? `${title}: ${message} — View: ${process.env.NEXT_PUBLIC_APP_URL || ''}${actionUrl}`
            : `${title}: ${message}`;
        sendSmsNotification(phone, smsBody).catch(err => console.error('[dispatchNotification] SMS send error:', err));
    }

    if (profile.push_enabled && profile.push_subscription && PUSH_PRIORITY_THRESHOLD.has(priority)) {
        const sub = profile.push_subscription as PushSubscription;
        sendPushNotification(sub, title, message, actionUrl).catch(err => console.error('[dispatchNotification] Push send error:', err));
    }
}
