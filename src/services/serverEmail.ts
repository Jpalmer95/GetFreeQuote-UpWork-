import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmailNotification, EmailPreferences } from '@/services/emailService';

export async function sendNotificationEmail(
    userId: string,
    notificationType: string,
    title: string,
    message: string,
    actionUrl?: string,
): Promise<void> {
    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email, email_preferences')
            .eq('id', userId)
            .single();

        if (!profile?.email) return;

        await sendEmailNotification({
            recipientEmail: profile.email,
            recipientUserId: userId,
            notificationType,
            title,
            message,
            actionUrl,
            emailPreferences: (profile.email_preferences as EmailPreferences) || null,
        });
    } catch (err) {
        console.error('[serverEmail] Failed to send notification email:', err);
    }
}
